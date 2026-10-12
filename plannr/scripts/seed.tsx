// Seeds demo data: "Demo Vermogensbeheer B.V." with an owner, a planner,
// 4 clients (one complete DGA case with a finished plan and an exported PDF),
// plus a Plannr super admin account.
//
// Usage:  npm run seed            (once)
//         npm run seed -- --opnieuw   (remove the demo data first, then seed again)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
// The secret key bypasses Row Level Security: never expose it to the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderReportPdf } from "@/lib/pdf/render";
import { buildReport } from "@/lib/report/build";
import { REPORT_SECTION_KEYS, STEP_KEYS } from "@/lib/plan/definitions";
import type { PlanConfig } from "@/lib/plan/types";

const FIRM_NAME = "Demo Vermogensbeheer B.V.";
const PASSWORD = process.env.SEED_PASSWORD ?? "Plannr-demo-2026!";
const OWNER = { email: "eigenaar@example.com", name: "Eva de Boer" };
const PLANNER = { email: "planner@example.com", name: "Mark Visser" };
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "beheer@example.com", name: "Plannr beheer" };

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\n✖ ${name} ontbreekt in .env.local (zie README.md).\n`);
    process.exit(1);
  }
  return v;
}

async function findUser(db: SupabaseClient, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function removeDemo(db: SupabaseClient) {
  const owner = await findUser(db, OWNER.email);
  if (owner) {
    const { data: profile } = await db.from("users").select("firm_id").eq("id", owner.id).maybeSingle();
    if (profile) {
      for (const bucket of ["documents", "exports", "logos"]) {
        const { data: folders } = await db.storage.from(bucket).list(profile.firm_id, { limit: 1000 });
        for (const f of folders ?? []) {
          const { data: files } = await db.storage.from(bucket).list(`${profile.firm_id}/${f.name}`, { limit: 1000 });
          const paths = (files ?? []).map((x) => `${profile.firm_id}/${f.name}/${x.name}`);
          if (paths.length) await db.storage.from(bucket).remove(paths);
          if (f.id) await db.storage.from(bucket).remove([`${profile.firm_id}/${f.name}`]);
        }
      }
      await db.from("firms").delete().eq("id", profile.firm_id);
    }
  }
  for (const who of [OWNER, PLANNER, ADMIN]) {
    const u = await findUser(db, who.email);
    if (u) await db.auth.admin.deleteUser(u.id);
  }
  await db.from("invitations").delete().eq("email", PLANNER.email);
}

async function createUser(db: SupabaseClient, email: string, metadata: Record<string, string>) {
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: metadata });
  if (error || !data.user) throw new Error(`Gebruiker ${email} aanmaken mislukt: ${error?.message}`);
  return data.user.id;
}

async function main() {
  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (process.argv.includes("--opnieuw")) {
    console.log("• Bestaande demodata verwijderen…");
    await removeDemo(db);
  } else if (await findUser(db, OWNER.email)) {
    console.log(`Demodata bestaat al. Gebruik "npm run seed -- --opnieuw" om opnieuw te beginnen.`);
    return;
  }

  // 1. Firm + owner (the database trigger creates the firm and default house style).
  console.log("• Kantoor en eigenaar aanmaken…");
  const ownerId = await createUser(db, OWNER.email, { name: OWNER.name, firm_name: FIRM_NAME });
  const { data: owner } = await db.from("users").select("firm_id").eq("id", ownerId).single();
  if (!owner) throw new Error("Trigger heeft geen kantoor aangemaakt. Is de migratie uitgevoerd?");
  const firmId = owner.firm_id as string;
  await db.from("firms").update({ website_url: "https://www.example.com" }).eq("id", firmId);
  await db
    .from("house_styles")
    .update({ primary_color: "#1F3A5F", secondary_color: "#5B7DB1", accent_color: "#C9A227", font_heading: "Merriweather", font_body: "Source Sans 3", layout_variant: "klassiek" })
    .eq("firm_id", firmId);

  // 2. Planner via an invitation (exactly like the app does it).
  console.log("• Planner uitnodigen…");
  await db.from("invitations").insert({ firm_id: firmId, email: PLANNER.email, invited_by: ownerId });
  const plannerId = await createUser(db, PLANNER.email, { name: PLANNER.name });

  // 3. Super admin (no firm).
  console.log("• Super admin aanmaken…");
  const adminId = (await findUser(db, ADMIN.email))?.id ?? (await createUser(db, ADMIN.email, { name: ADMIN.name }));
  await db.from("super_admins").upsert({ user_id: adminId });

  // 4. Clients.
  console.log("• Cliënten aanmaken…");
  const clients = [
    { first_name: "Sanne", last_name: "Bakker", company_name: null, created_by: plannerId },
    { first_name: "Pieter", last_name: "Jansen", company_name: null, created_by: ownerId },
    { first_name: "Fatima", last_name: "El Amrani", company_name: "Amrani Consultancy B.V.", created_by: plannerId },
    { first_name: "Jan", last_name: "de Vries", company_name: "De Vries Holding B.V.", created_by: ownerId },
  ];
  const ids: Record<string, string> = {};
  for (const c of clients) {
    const { data, error } = await db.from("clients").insert({ ...c, firm_id: firmId }).select("id").single();
    if (error || !data) throw error;
    ids[c.last_name] = data.id;
  }

  await db.from("client_notes").insert([
    {
      firm_id: firmId,
      client_id: ids["de Vries"],
      author_id: ownerId,
      content: "Kennismaking gehad. Jan overweegt over 5 à 7 jaar te stoppen en de BV te verkopen. Wil weten of het vermogen dan toereikend is.",
    },
    {
      firm_id: firmId,
      client_id: ids["de Vries"],
      author_id: plannerId,
      content: "Jaarrekening 2025 en IB-aangifte 2025 ontvangen. Pensioen in eigen beheer is in 2017 omgezet naar ODV.",
    },
  ]);

  // 5. The complete DGA plan.
  console.log("• Volledig DGA-plan aanmaken…");
  const fullConfig: PlanConfig = {
    sections: { eigen_woning: true, inkomen: true, box3: true, pensioen: true, bv: true, balans: true, resultaat: true, pensioen_eigen_beheer: true, dividend: true },
    reportSections: [...REPORT_SECTION_KEYS],
    visitedSteps: [...STEP_KEYS],
  };
  const { data: plan, error: planError } = await db
    .from("plans")
    .insert({
      firm_id: firmId,
      client_id: ids["de Vries"],
      title: "Plan 2026",
      status: "afgerond",
      current_step: "rapport",
      config: fullConfig,
      inputs: {
        prive: { geboortejaar: 1968, pensioenleeftijd: 65, bruto_inkomen: 0, jaarlijkse_uitgaven: 84_000, pensioen_per_jaar: 12_000, aow_situatie: "samenwonend" },
        fromDocument: [],
      },
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (planError || !plan) throw planError;

  const asset = (side: string, type: string, tax_box: number, label: string, value: number | null, metadata: Record<string, unknown> = {}, sort_order = 0) => ({
    firm_id: firmId,
    plan_id: plan.id,
    side,
    type,
    tax_box,
    label,
    value,
    metadata,
    source: "handmatig",
    sort_order,
  });
  await db.from("assets").insert([
    asset("prive", "eigen_woning", 1, "Herengracht 12, Haarlem", 1_150_000),
    asset("prive", "hypotheek", 1, "Leningdeel 1", 360_000, { rente: 3.4, aflosvorm: "annuitair" }, 1),
    asset("prive", "hypotheek", 1, "Leningdeel 2", 140_000, { rente: 4.1, aflosvorm: "aflossingsvrij" }, 2),
    asset("prive", "spaargeld", 3, "ING Spaarrekening", 95_000),
    asset("prive", "beleggingen", 3, "Beleggingsportefeuille", 410_000),
    asset("zakelijk", "bv_aandelen", 2, "", 1_640_000, {
      bv_naam: "De Vries Holding B.V.",
      aandelen_percentage: 100,
      eigen_vermogen: 1_640_000,
      liquide_middelen: 620_000,
      resultaat_na_belasting: 235_000,
      odv_waarde: 310_000,
      salaris_dga: 78_000,
      dividenduitkering: 90_000,
    }),
  ]);

  await db.from("plans").insert({
    firm_id: firmId,
    client_id: ids["de Vries"],
    title: "Wat-als: stoppen op 60",
    status: "concept",
    config: { ...fullConfig, visitedSteps: ["configuratie"] },
    inputs: { prive: { geboortejaar: 1968, pensioenleeftijd: 60 }, fromDocument: [] },
    created_by: ownerId,
  });

  await db.from("plans").insert({
    firm_id: firmId,
    client_id: ids["Bakker"],
    title: "Plan 2026",
    status: "in_bewerking",
    config: { ...fullConfig, sections: { ...fullConfig.sections, bv: false, balans: false, resultaat: false, pensioen_eigen_beheer: false, dividend: false }, visitedSteps: ["configuratie", "documenten"] },
    inputs: { prive: { geboortejaar: 1985, pensioenleeftijd: 67, bruto_inkomen: 68_000 }, fromDocument: [] },
    created_by: plannerId,
  });

  // 6. One exported PDF in the history of the DGA client.
  console.log("• PDF-rapport exporteren…");
  const report = await buildReport(db, plan.id, { plannerName: OWNER.name });
  if (!report) throw new Error("Rapport kon niet worden opgebouwd.");
  const pdf = await renderReportPdf(report.data, report.style, report.logo);
  const exportId = crypto.randomUUID();
  const pdfPath = `${firmId}/${plan.id}/${exportId}.pdf`;
  const { error: uploadError } = await db.storage.from("exports").upload(pdfPath, pdf, { contentType: "application/pdf" });
  if (uploadError) throw uploadError;
  await db.from("exports").insert({
    id: exportId,
    firm_id: firmId,
    plan_id: plan.id,
    pdf_path: pdfPath,
    sections_included: report.data.sections,
    house_style_snapshot: report.style,
    created_by: ownerId,
  });

  console.log(`
✔ Demodata aangemaakt voor "${FIRM_NAME}".

  Eigenaar     ${OWNER.email}
  Planner      ${PLANNER.email}
  Super admin  ${ADMIN.email}   (inloggen via /admin of het admin-subdomein)
  Wachtwoord   ${PASSWORD}   (voor alle drie)
`);
}

main().catch((e) => {
  console.error("\n✖ Seeden mislukt:", e instanceof Error ? e.message : e);
  process.exit(1);
});
