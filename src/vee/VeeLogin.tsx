import { useState, type FormEvent } from "react";
import VeeAvatar from "@/vee/VeeAvatar";
import { checkLogin, setAccessCode } from "@/vee/api";

interface Props {
  /** Whether the server wants an access code (VEE_ACCESS_CODE is set). */
  codeRequired: boolean;
  initialName: string;
  color: string;
  onLoggedIn: (userName: string) => void;
}

/**
 * Step 1 of the flow: say who you are, and enter the access code if the
 * tryout is locked. Not real accounts yet (that's the onboarding phase); the
 * code is checked by the server so a wrong one is caught right here.
 */
export default function VeeLogin({ codeRequired, initialName, color, onLoggedIn }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && (!codeRequired || code.trim().length > 0) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const ok = await checkLogin(code.trim());
      if (!ok) {
        setError("That code doesn't match. Check it and try again.");
        return;
      }
      setAccessCode(code.trim());
      onLoggedIn(name.trim());
    } catch {
      setError("Couldn't reach Vee right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vee min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl border border-[#2c2c2a]/5">
        <div className="flex flex-col items-center text-center">
          <VeeAvatar state="idle" size={96} color={color} />
          <h1 className="mt-4 text-2xl font-extrabold">Welcome to Vee</h1>
          <p className="mt-1 text-sm text-[#2c2c2a]/60">Log in to meet your personal helper.</p>
        </div>

        <label className="mt-6 block text-sm font-bold" htmlFor="vee-name">
          Your name
        </label>
        <input
          id="vee-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#2c2c2a]/20 px-3 py-2.5 outline-none focus:border-[#F0997B]"
          placeholder="What should Vee call you?"
          maxLength={30}
          autoComplete="given-name"
          autoFocus
        />

        {codeRequired && (
          <>
            <label className="mt-4 block text-sm font-bold" htmlFor="vee-code">
              Access code
            </label>
            <input
              id="vee-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#2c2c2a]/20 px-3 py-2.5 outline-none focus:border-[#F0997B]"
              placeholder="The code you were given"
              autoComplete="current-password"
            />
          </>
        )}

        {error && <p className="mt-3 text-sm text-[#b23b3b]">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 w-full rounded-xl bg-[#F0997B] py-3 font-bold text-white disabled:opacity-40"
        >
          {busy ? "Checking…" : "Log in"}
        </button>

        <p className="mt-4 text-center text-[11px] text-[#2c2c2a]/45">
          Your name and Vee settings stay in this browser.
        </p>
      </form>
    </div>
  );
}
