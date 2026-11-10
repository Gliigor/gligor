// Cards for Pepebo. Numbers 1–12 in three pond colours; the wild card is a Pepe.
import { FrogHead } from "@/pepudo/Die";
import { HIDDEN, WILD } from "./engine";

const SIZES = {
  sm: { w: 30, h: 42, num: 17, corner: 0, frog: 22, radius: 6 },
  md: { w: 48, h: 68, num: 28, corner: 11, frog: 34, radius: 9 },
  lg: { w: 58, h: 82, num: 34, corner: 12, frog: 42, radius: 10 },
};
export type CardSize = keyof typeof SIZES;

const tone = (n: number) =>
  n <= 4
    ? { bg: "#eaf7cd", ink: "#3d6f14", edge: "#9fc65f" } // lily green
    : n <= 8
      ? { bg: "#fdefc4", ink: "#8a5b00", edge: "#dcae45" } // reed gold
      : { bg: "#fbdbe4", ink: "#a02a4c", edge: "#e08aa2" }; // lotus pink

interface CardProps {
  /** A number 1–12, WILD, HIDDEN (face down), or undefined for an empty slot. */
  card?: number;
  /** For a Pepe lying on a build pile: the number it stands for. */
  as?: number;
  size?: CardSize;
  selected?: boolean;
  glow?: boolean;
  /** Text shown in an empty slot. */
  empty?: string;
  onClick?: () => void;
  label?: string;
}

export const Card = ({ card, as, size = "md", selected, glow, empty, onClick, label }: CardProps) => {
  const z = SIZES[size];
  const frame = `relative inline-flex shrink-0 select-none items-center justify-center font-black transition-all duration-150 ${
    selected ? "-translate-y-2 ring-[3px] ring-[#ffd54a]" : glow ? "ring-[3px] ring-[#b7f27a]" : ""
  } ${onClick ? "cursor-pointer active:scale-95" : ""}`;
  const style: React.CSSProperties = { width: z.w, height: z.h, borderRadius: z.radius };
  const Tag = onClick ? "button" : "span";
  const common = { onClick, "aria-label": label, type: onClick ? ("button" as const) : undefined };

  if (card === undefined) {
    return (
      <Tag {...common} className={`${frame} border-2 border-dashed border-white/25 bg-black/15 text-white/30`} style={style}>
        <span style={{ fontSize: z.num * 0.7 }}>{empty}</span>
      </Tag>
    );
  }
  if (card === HIDDEN) {
    return (
      <Tag
        {...common}
        className={`${frame} border-2 border-[#7fbf5a] shadow-[0_2px_0_rgba(0,0,0,0.35)]`}
        style={{ ...style, background: "repeating-linear-gradient(45deg, #1f5a32 0 6px, #24683a 6px 12px)" }}
      >
        <FrogHead size={z.frog * 0.8} className="opacity-60" />
      </Tag>
    );
  }
  if (card === WILD) {
    return (
      <Tag
        {...common}
        className={`${frame} border-2 border-[#b7f27a] bg-[#16402a] shadow-[0_2px_0_rgba(0,0,0,0.35)]`}
        style={style}
      >
        {z.corner > 0 && (
          <span className="absolute left-1 top-0.5 leading-none text-[#b7f27a]" style={{ fontSize: z.corner }}>
            P
          </span>
        )}
        <FrogHead size={z.frog} />
        {as !== undefined && (
          <span
            className="absolute right-0.5 top-0.5 rounded-md bg-[#b7f27a] px-1 leading-tight text-[#0d2b1b]"
            style={{ fontSize: Math.max(10, z.num * 0.45) }}
          >
            {as}
          </span>
        )}
      </Tag>
    );
  }
  const t = tone(card);
  return (
    <Tag
      {...common}
      className={`${frame} border-2 shadow-[0_2px_0_rgba(0,0,0,0.35)]`}
      style={{ ...style, background: t.bg, borderColor: t.edge, color: t.ink }}
    >
      {z.corner > 0 && (
        <span className="absolute left-1 top-0.5 leading-none" style={{ fontSize: z.corner }}>
          {card}
        </span>
      )}
      <span style={{ fontSize: z.num, lineHeight: 1 }}>{card}</span>
    </Tag>
  );
};

/** A discard pile: the top card in full, with the cards underneath peeking out above it. */
export const Stack = ({
  pile,
  size = "md",
  selected,
  glow,
  onClick,
  label,
}: {
  pile: number[];
  size?: CardSize;
  selected?: boolean;
  glow?: boolean;
  onClick?: () => void;
  label?: string;
}) => {
  const z = SIZES[size];
  const peek = size === "sm" ? 0 : 15;
  const shown = pile.slice(-5);
  const hiddenCount = pile.length - shown.length;
  if (pile.length === 0) return <Card size={size} glow={glow} onClick={onClick} label={label} />;
  return (
    <span className="relative inline-block shrink-0" style={{ width: z.w, height: z.h + peek * (shown.length - 1) }}>
      {shown.map((card, i) => {
        const isTop = i === shown.length - 1;
        return (
          <span key={i} className="absolute left-0" style={{ top: i * peek, zIndex: i }}>
            <Card
              card={card}
              size={size}
              selected={isTop && selected}
              glow={isTop && glow}
              onClick={isTop ? onClick : undefined}
              label={isTop ? label : undefined}
            />
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="absolute -right-1 -top-2 z-10 rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-white">
          +{hiddenCount}
        </span>
      )}
    </span>
  );
};
