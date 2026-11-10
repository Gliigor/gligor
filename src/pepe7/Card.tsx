// Cards for Pepe 7. Numbers each get their own ink; the 7 is a Pepe.
import { Heart, Layers, Snowflake } from "lucide-react";
import { FrogHead } from "@/pepudo/Die";
import { Card as CardT, isNumber, isModifier } from "./engine";

const SIZES = {
  sm: { w: 26, h: 37, num: 15, corner: 0, icon: 15, radius: 5 },
  md: { w: 44, h: 62, num: 25, corner: 10, icon: 24, radius: 8 },
  lg: { w: 54, h: 76, num: 31, corner: 11, icon: 30, radius: 9 },
};
export type CardSize = keyof typeof SIZES;

const INK: Record<number, string> = {
  0: "#6b6b6b",
  1: "#8a5a2b",
  2: "#2f7d6d",
  3: "#c0392b",
  4: "#2c6fb5",
  5: "#b8860b",
  6: "#7b3fa0",
  8: "#d35400",
  9: "#16805a",
  10: "#a8326e",
  11: "#3949ab",
  12: "#5d6d1e",
};

interface Props {
  card: CardT;
  size?: CardSize;
  /** Draws attention to a card that just arrived. */
  fresh?: boolean;
  /** Greyed out (busted hands). */
  dim?: boolean;
  /** Red ring: the card that caused a bust. */
  bad?: boolean;
}

export const PepeCard = ({ card, size = "md", fresh, dim, bad }: Props) => {
  const z = SIZES[size];
  const base = `relative inline-flex shrink-0 select-none items-center justify-center font-black border-2 shadow-[0_2px_0_rgba(0,0,0,0.35)] ${
    fresh ? "animate-in zoom-in-50 fade-in duration-300 ring-2 ring-[#ffd54a]" : ""
  } ${bad ? "ring-[3px] ring-red-500" : ""} ${dim ? "opacity-40 grayscale" : ""}`;
  const style: React.CSSProperties = { width: z.w, height: z.h, borderRadius: z.radius };
  const corner = (text: string, color: string) =>
    z.corner > 0 && (
      <span className="absolute left-1 top-0.5 leading-none" style={{ fontSize: z.corner, color }}>
        {text}
      </span>
    );

  if (card === 7) {
    return (
      <span className={`${base} border-[#b7f27a] bg-[#16402a]`} style={style} aria-label="7 (Pepe)">
        {corner("7", "#b7f27a")}
        <FrogHead size={z.w * 0.92} />
        {z.corner > 0 && (
          <span
            className="absolute bottom-0.5 right-1 rotate-180 leading-none text-[#b7f27a]"
            style={{ fontSize: z.corner }}
          >
            7
          </span>
        )}
        {size === "sm" && (
          <span className="absolute -right-1 -top-1 rounded bg-[#b7f27a] px-0.5 text-[9px] leading-tight text-[#0d2b1b]">
            7
          </span>
        )}
      </span>
    );
  }
  if (isNumber(card)) {
    const ink = INK[card];
    return (
      <span className={base} style={{ ...style, background: "#fbf6e9", borderColor: ink, color: ink }} aria-label={`${card}`}>
        {corner(String(card), ink)}
        <span style={{ fontSize: card >= 10 ? z.num * 0.85 : z.num, lineHeight: 1 }}>{card}</span>
      </span>
    );
  }
  if (isModifier(card)) {
    const text = card === "x2" ? "×2" : card;
    return (
      <span
        className={`${base} border-[#e0a526] text-[#5a3b00]`}
        style={{ ...style, background: "linear-gradient(160deg, #ffe08a, #f4b93a)" }}
        aria-label={text}
      >
        <span style={{ fontSize: z.num * (text.length > 2 ? 0.62 : 0.8), lineHeight: 1 }}>{text}</span>
      </span>
    );
  }
  const look = {
    freeze: { bg: "linear-gradient(160deg, #d6f1ff, #7cc4ef)", edge: "#3f8fc4", ink: "#0d4f7a", Icon: Snowflake, label: "Freeze" },
    flip3: { bg: "linear-gradient(160deg, #eadcff, #a985ea)", edge: "#7451b8", ink: "#3b1f73", Icon: Layers, label: "Flip Three" },
    chance: { bg: "linear-gradient(160deg, #ffe0ea, #f48fb1)", edge: "#c2185b", ink: "#7a0c36", Icon: Heart, label: "Second Chance" },
  }[card];
  return (
    <span className={base} style={{ ...style, background: look.bg, borderColor: look.edge, color: look.ink }} aria-label={look.label}>
      <look.Icon size={z.icon} strokeWidth={2.5} />
      {card === "flip3" && (
        <span className="absolute bottom-0.5 right-1 leading-none" style={{ fontSize: Math.max(9, z.corner) }}>
          3
        </span>
      )}
    </span>
  );
};

/** Face-down card for the draw pile. */
export const CardBack = ({ size = "md" }: { size?: CardSize }) => {
  const z = SIZES[size];
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center border-2 border-[#7fbf5a] shadow-[0_2px_0_rgba(0,0,0,0.35)]"
      style={{
        width: z.w,
        height: z.h,
        borderRadius: z.radius,
        background: "repeating-linear-gradient(45deg, #1f5a32 0 6px, #24683a 6px 12px)",
      }}
    >
      <FrogHead size={z.w * 0.7} className="opacity-60" />
    </span>
  );
};
