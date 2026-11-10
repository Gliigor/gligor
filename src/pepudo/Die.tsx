// Dice for Pepudo. The 1 face (the wild one) is a smug frog head.

export const FrogHead = ({ size = 40, className = "" }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="Pepe">
    {/* eye bulges + head */}
    <circle cx="31" cy="36" r="19" fill="#5f9e3a" stroke="#2c5a1a" strokeWidth="3" />
    <circle cx="69" cy="36" r="19" fill="#5f9e3a" stroke="#2c5a1a" strokeWidth="3" />
    <ellipse cx="50" cy="62" rx="45" ry="30" fill="#5f9e3a" stroke="#2c5a1a" strokeWidth="3" />
    <circle cx="31" cy="36" r="16.5" fill="#5f9e3a" />
    <circle cx="69" cy="36" r="16.5" fill="#5f9e3a" />
    {/* eyes */}
    <ellipse cx="31" cy="40" rx="13" ry="10" fill="#fff" stroke="#2c5a1a" strokeWidth="2" />
    <ellipse cx="69" cy="40" rx="13" ry="10" fill="#fff" stroke="#2c5a1a" strokeWidth="2" />
    <circle cx="35" cy="42" r="5" fill="#111" />
    <circle cx="73" cy="42" r="5" fill="#111" />
    {/* smug heavy eyelids */}
    <path d="M17,40 A14,11 0 0 1 45,40 Z" fill="#5f9e3a" stroke="#2c5a1a" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M55,40 A14,11 0 0 1 83,40 Z" fill="#5f9e3a" stroke="#2c5a1a" strokeWidth="2.5" strokeLinejoin="round" />
    {/* nostrils */}
    <circle cx="45" cy="56" r="1.6" fill="#2c5a1a" />
    <circle cx="55" cy="56" r="1.6" fill="#2c5a1a" />
    {/* lips */}
    <path d="M18,68 Q50,80 84,66" fill="none" stroke="#a5452f" strokeWidth="7" strokeLinecap="round" />
    <path d="M24,72 Q50,86 78,71" fill="none" stroke="#7d3222" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const PIPS: Record<number, [number, number][]> = {
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

interface DieProps {
  face?: number | null;
  size?: number;
  highlight?: boolean;
  dim?: boolean;
  className?: string;
}

/** `face` null/undefined renders a hidden die. */
export const Die = ({ face, size = 44, highlight = false, dim = false, className = "" }: DieProps) => {
  const hidden = !face;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[22%] shrink-0 transition-all ${
        hidden ? "bg-[#1d2b22] border border-[#3c5a45]" : "bg-[#f6efdc] border border-[#c9bb92] shadow-[0_2px_0_#a8986b]"
      } ${highlight ? "ring-2 ring-[#ffd54a] ring-offset-1 ring-offset-transparent scale-105" : ""} ${
        dim ? "opacity-35" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {hidden ? (
        <span className="text-[#5c8a68] font-bold" style={{ fontSize: size * 0.45 }}>
          ?
        </span>
      ) : face === 1 ? (
        <FrogHead size={size * 0.9} />
      ) : (
        <svg viewBox="0 0 100 100" width={size} height={size}>
          {PIPS[face].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9.5" fill="#2a2418" />
          ))}
        </svg>
      )}
    </span>
  );
};
