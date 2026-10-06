/**
 * Placeholder Vee.
 *
 * Phase 2 replaces this with the full character (shapes, eyes, mouths,
 * blinking, face tracking, sleeping...). For Phase 1 it only needs to show
 * three states: idle, thinking, and talking.
 */
export type AvatarState = "idle" | "thinking" | "talking";

interface Props {
  state: AvatarState;
  size?: number;
}

export default function VeeAvatar({ state, size = 96 }: Props) {
  const coral = "#F0997B";
  const ink = "#2C2C2A";
  const cheek = "#ED93B1";

  return (
    <div className="relative inline-block select-none" style={{ width: size, height: size }} aria-label={`Vee is ${state}`}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={state === "idle" ? "vee-breathe" : state === "talking" ? "vee-bob" : ""}
      >
        {/* body: a soft drop shape */}
        <path
          d="M50 8 C62 22, 86 36, 86 60 C86 80, 70 94, 50 94 C30 94, 14 80, 14 60 C14 36, 38 22, 50 8 Z"
          fill={coral}
        />
        {/* cheeks */}
        <circle cx="30" cy="66" r="6" fill={cheek} opacity="0.7" />
        <circle cx="70" cy="66" r="6" fill={cheek} opacity="0.7" />
        {/* eyes */}
        <circle cx="38" cy="54" r="4" fill={ink} />
        <circle cx="62" cy="54" r="4" fill={ink} />
        {/* mouth */}
        {state === "talking" ? (
          <ellipse cx="50" cy="70" rx="6" ry="5" fill={ink} />
        ) : (
          <path d="M42 68 Q50 76 58 68" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
      </svg>

      {/* thinking dots, bottom right, bounce in sequence */}
      {state === "thinking" && (
        <div className="absolute -bottom-1 -right-2 flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="vee-dot block h-2 w-2 rounded-full"
              style={{ background: ink, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
