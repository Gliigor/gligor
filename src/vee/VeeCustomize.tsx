import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import VeeAvatar from "@/vee/VeeAvatar";
import { COLORS, LANGUAGES, PERSONALITIES, type VeeProfile } from "@/vee/profile";

interface Props {
  profile: VeeProfile;
  /** True on first setup; false when opened again from the chat. */
  firstTime: boolean;
  onSave: (profile: VeeProfile) => void;
  onCancel?: () => void;
}

/**
 * Step 2 of the flow: give your Vee a name, a color, a personality and a
 * language. The preview at the top updates live.
 */
export default function VeeCustomize({ profile, firstTime, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<VeeProfile>(profile);
  const update = (patch: Partial<VeeProfile>) => setDraft((d) => ({ ...d, ...patch }));

  const veeName = draft.veeName.trim() || "Vee";

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({ ...draft, veeName });
  }

  return (
    <div className="vee min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl border border-[#2c2c2a]/5">
        <div className="flex flex-col items-center text-center">
          <VeeAvatar state="idle" size={112} color={draft.color} />
          <h1 className="mt-4 text-2xl font-extrabold">
            {firstTime ? `Hi ${draft.userName || "there"}! Let's make Vee yours.` : "Customize your Vee"}
          </h1>
          <p className="mt-1 text-sm text-[#2c2c2a]/60">You can change all of this later.</p>
        </div>

        <label className="mt-6 block text-sm font-bold" htmlFor="vee-helper-name">
          Name
        </label>
        <input
          id="vee-helper-name"
          value={draft.veeName}
          onChange={(e) => update({ veeName: e.target.value })}
          className="mt-1.5 w-full rounded-xl border border-[#2c2c2a]/20 px-3 py-2.5 outline-none focus:border-[#F0997B]"
          placeholder="Vee"
          maxLength={30}
        />

        <p className="mt-5 text-sm font-bold">Color</p>
        <div className="mt-2 flex gap-3" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={draft.color === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => update({ color: c.value })}
              className={
                "h-10 w-10 rounded-full inline-flex items-center justify-center transition-transform " +
                (draft.color === c.value ? "ring-2 ring-offset-2 ring-[#2c2c2a] scale-110" : "hover:scale-105")
              }
              style={{ background: c.value }}
            >
              {draft.color === c.value && <Check size={18} className="text-white" />}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm font-bold">Personality</p>
        <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Personality">
          {PERSONALITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={draft.personality === p.value}
              onClick={() => update({ personality: p.value })}
              className={
                "rounded-xl border px-3.5 py-2.5 text-left transition-colors " +
                (draft.personality === p.value
                  ? "border-[#F0997B] bg-[#F0997B]/10"
                  : "border-[#2c2c2a]/15 hover:border-[#2c2c2a]/30")
              }
            >
              <span className="block font-bold">{p.label}</span>
              <span className="block text-xs text-[#2c2c2a]/60">{p.hint}</span>
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-bold" htmlFor="vee-language">
          Language
        </label>
        <select
          id="vee-language"
          value={draft.language}
          onChange={(e) => update({ language: e.target.value as VeeProfile["language"] })}
          className="mt-1.5 w-full rounded-xl border border-[#2c2c2a]/20 bg-white px-3 py-2.5 outline-none focus:border-[#F0997B]"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="mt-7 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-[#2c2c2a]/15 py-3 font-bold text-[#2c2c2a]/70 hover:bg-[#2c2c2a]/5"
            >
              Cancel
            </button>
          )}
          <button type="submit" className="flex-[2] rounded-xl bg-[#F0997B] py-3 font-bold text-white">
            {firstTime ? `Meet ${veeName}` : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
