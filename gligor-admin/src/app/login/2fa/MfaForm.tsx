"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type Mode = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string };

/** Tweede stap: code uit de authenticator-app (bij de eerste keer eerst de QR-code scannen). */
export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    (async () => {
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) return setError(e.message);
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });
      // Half afgemaakte eerdere pogingen opruimen.
      for (const f of data.all.filter((f) => f.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Gligor admin ${new Date().toISOString().slice(0, 10)}` });
      if (enrolled.error) return setError(enrolled.error.message);
      setMode({ kind: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode.kind === "loading") return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code: code.trim() });
    setBusy(false);
    if (err) return setError("Deze code klopt niet. Probeer de nieuwste code uit je app.");
    router.replace("/vandaag");
    router.refresh();
  };

  if (mode.kind === "loading") return <p className="text-muted">{error ?? "Even laden…"}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode.kind === "enroll" && (
        <div className="space-y-2 text-[13px] text-muted">
          <p>Eenmalig: scan deze QR-code met een authenticator-app (bijv. 1Password, Google Authenticator of Microsoft Authenticator).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mode.qr} alt="QR-code voor tweestapsverificatie" className="mx-auto size-44 rounded-md bg-white p-2" />
          <p>
            Of voer deze sleutel in: <code className="num break-all text-fg">{mode.secret}</code>
          </p>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Code uit je app</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="num text-center text-lg tracking-[0.3em]"
          autoFocus
          required
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || code.length !== 6}>
        {busy ? "Controleren…" : "Bevestigen"}
      </button>
    </form>
  );
}
