import { useMemo, useState } from "react";

type Rules = Record<string, string[]>;

const DEFAULT_RULES: Rules = {
  Vve: ["vve", "vereniging van eigenaars"],
  Fbto: ["fbto"],
  Boodschappen: ["albert heijn", "ah ", "jumbo", "lidl", "aldi", "kruidvat", "etos", "dirk", "plus", "spar"],
  Action: ["action"],
  "Tegels en Wc": ["tegels", "sanitair", "wc", "badkamer", "hornbach", "praxis", "gamma", "karwei"],
  Auto: ["apk", "garage", "onderhoud", "banden"],
  Benzine: ["tinq", "argos", "shell", "esso", "bp", "total", "texaco", "avia"],
  "Auto wassen": ["carwash", "auto was", "wasstraat", "wash"],
  "Basic fit": ["basic fit", "basic-fit"],
  overlijdensrisicoverzekering: ["overlijdens", "risicoverzekering", "rheinland", "verzekering"],
  Hypotheek: ["hypotheek"],
  Nuts: ["vattenfall", "eneco", "essent", "ziggo", "kpn", "odido", "t-mobile", "water", "netbeheer", "stroom", "gas"],
};

function detectDelimiter(headerLine: string) {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function splitCSVLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lines.length < 2) throw new Error("CSV lijkt leeg.");

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length === 1 && cols[0].trim() === "") continue;

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    rows.push(obj);
  }
  return rows;
}

function euroToNumber(s: string) {
  const cleaned = String(s || "")
    .replace(/\./g, "") // duizendtallen
    .replace(",", ".")
    .replace(/\s/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalize(s: string) {
  return String(s || "").toLowerCase();
}

function monthKey(dateStr: string) {
  const s = String(dateStr || "").trim();
  if (!s) return "Onbekend";

  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
  if (m1) return `${m1[1]}-${m1[2]}`;

  const m2 = s.match(/^(\d{2})-(\d{2})-(\d{4})/); // DD-MM-YYYY
  if (m2) return `${m2[3]}-${m2[2]}`;

  return "Onbekend";
}

function categorize(row: Record<string, string>, rules: Rules) {
  const name = normalize(row["Name"] || row["Naam"] || "");
  const desc = normalize(row["Description"] || row["Omschrijving"] || row["Beschrijving"] || "");
  const hay = (name + " " + desc).trim();

  for (const [cat, keywords] of Object.entries(rules)) {
    for (const kw of keywords) {
      if (!kw) continue;
      if (hay.includes(String(kw).toLowerCase())) return cat;
    }
  }
  return "Overig";
}

function formatEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);
}

export default function CsvDashboard() {
  const [status, setStatus] = useState<string>("");
  const [rulesText, setRulesText] = useState<string>(JSON.stringify(DEFAULT_RULES, null, 2));
  const [monthTotals, setMonthTotals] = useState<Record<string, number>>({});
  const [pivot, setPivot] = useState<Record<string, Record<string, number>>>({});
  const [uncat, setUncat] = useState<Array<any>>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    Object.values(pivot).forEach((byCat) => Object.keys(byCat).forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nl"));
  }, [pivot]);

  async function handleFile(file: File) {
    setStatus("Bezig met inlezen...");
    setMonthTotals({});
    setPivot({});
    setUncat([]);

    let rules: Rules = DEFAULT_RULES;
    try {
      rules = JSON.parse(rulesText);
    } catch {
      // keep default
    }

    const text = await file.text();
    const rows = parseCSV(text);

    const mt: Record<string, number> = {};
    const pv: Record<string, Record<string, number>> = {};
    const un: any[] = [];
    let processed = 0;

    for (const row of rows) {
      const amount = euroToNumber(row["Amount"] || row["Bedrag"]);
      if (!(amount < 0)) continue; // alleen uitgaven

      const date = row["Date"] || row["Datum"] || row["Booking date"] || "";
      const month = monthKey(date);

      const cat = categorize(row, rules);
      const spend = Math.abs(amount);

      mt[month] = (mt[month] || 0) + spend;
      pv[month] = pv[month] || {};
      pv[month][cat] = (pv[month][cat] || 0) + spend;

      if (cat === "Overig") {
        un.push({
          month,
          date,
          amount: spend,
          name: row["Name"] || row["Naam"] || "",
          desc: row["Description"] || row["Omschrijving"] || "",
        });
      }

      processed++;
    }

    // sort months
    const months = Object.keys(mt).sort();
    const mtSorted: Record<string, number> = {};
    const pvSorted: Record<string, Record<string, number>> = {};
    for (const m of months) {
      mtSorted[m] = mt[m];
      pvSorted[m] = pv[m];
    }

    setMonthTotals(mtSorted);
    setPivot(pvSorted);
    setUncat(un);
    setStatus(`Klaar: ${processed} uitgaven verwerkt.`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">CSV Dashboard Tool</h1>
            <p className="text-muted-foreground mt-1">
              Upload bunq CSV → categoriseer uitgaven → totals per maand en per categorie. Alles lokaal in je browser.
            </p>
          </div>
          <a href="/#/" className="underline text-sm text-muted-foreground">
            ← terug naar home
          </a>
        </div>

        <div className="mt-6 rounded-xl border p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setRulesText(JSON.stringify(DEFAULT_RULES, null, 2))}
              type="button"
            >
              Reset demo categorieën
            </button>
            <span className="text-sm text-muted-foreground">{status}</span>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm">Keywords aanpassen (optioneel)</summary>
            <p className="text-sm text-muted-foreground mt-2">
              JSON mapping: categorie → lijst met keywords (matcht in Name/Description).
            </p>
            <textarea
              className="mt-2 w-full min-h-[160px] rounded-lg border bg-background p-3 text-xs font-mono"
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
            />
          </details>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h2 className="font-semibold">Totals per maand</h2>
            <p className="text-sm text-muted-foreground">Som van alle uitgaven (negatieve bedragen) per maand.</p>

            <div className="mt-3 overflow-auto">
              {Object.keys(monthTotals).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen data. Upload een CSV.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Maand</th>
                      <th className="text-right py-2">Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(monthTotals).map(([m, v]) => (
                      <tr key={m} className="border-b">
                        <td className="py-2 pr-3">{m}</td>
                        <td className="py-2 text-right">{formatEUR(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="font-semibold">Per maand × categorie</h2>
            <p className="text-sm text-muted-foreground">Pivot: uitgaven per categorie per maand.</p>

            <div className="mt-3 overflow-auto">
              {Object.keys(pivot).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen data. Upload een CSV.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Maand</th>
                      {categories.map((c) => (
                        <th key={c} className="text-right py-2 px-2">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(pivot).map(([m, byCat]) => (
                      <tr key={m} className="border-b">
                        <td className="py-2 pr-3">{m}</td>
                        {categories.map((c) => {
                          const v = byCat[c] || 0;
                          return (
                            <td key={c} className="py-2 px-2 text-right">
                              {v ? formatEUR(v) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 mt-6">
          <h2 className="font-semibold">Ongecategoriseerd (Overig)</h2>
          <p className="text-sm text-muted-foreground">Transacties die geen keyword matchten.</p>

          <div className="mt-3 overflow-auto">
            {uncat.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen (Overig) transacties 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Maand</th>
                    <th className="text-left py-2 pr-3">Datum</th>
                    <th className="text-right py-2 pr-3">Bedrag</th>
                    <th className="text-left py-2 pr-3">Name</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {uncat.slice(0, 200).map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 pr-3">{r.month}</td>
                      <td className="py-2 pr-3">{r.date}</td>
                      <td className="py-2 pr-3 text-right">{formatEUR(r.amount)}</td>
                      <td className="py-2 pr-3">{r.name}</td>
                      <td className="py-2">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {uncat.length > 200 && (
              <p className="text-sm text-muted-foreground mt-2">Toont eerste 200 items.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
