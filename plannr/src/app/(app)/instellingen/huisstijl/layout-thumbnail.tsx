// Lightweight HTML impression of a report design (cover + first content page).
// Mirrors the building blocks in src/lib/pdf/report.tsx; "Volledig bekijken" opens the real PDF.

import type { DesignBlocks, HouseStyle } from "@/lib/house-style/types";

function tint(hex: string, amount: number) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#f3f4f6";
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** White or near-black text on a background, like onColor() in the PDF. */
function textOn(hex: string) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#fff";
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#1f2328" : "#fff";
}

const SHEET = "relative aspect-[210/297] w-full overflow-hidden rounded-sm bg-white shadow ring-1 ring-ink-200";
const PAPER = "#f7f7f5";

export function LayoutThumbnail({
  blocks,
  style,
  firmName,
  logoUrl,
}: {
  blocks: DesignBlocks;
  style: Pick<HouseStyle, "primaryColor" | "secondaryColor" | "accentColor" | "fontHeading" | "fontBody">;
  firmName: string;
  logoUrl: string | null;
}) {
  const heading = { fontFamily: `"${style.fontHeading}"` };
  const body = { fontFamily: `"${style.fontBody}"` };
  const on = textOn(style.primaryColor);
  const logo = (onPrimary = false) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={`max-h-4 max-w-[60%] object-contain ${onPrimary ? "rounded-sm bg-white p-0.5" : ""}`} />
    ) : (
      <span className="block max-w-full break-words text-[7px] font-bold leading-tight" style={{ ...heading, color: onPrimary ? on : style.primaryColor }}>
        {firmName}
      </span>
    );

  let cover: React.ReactNode;
  if (blocks.cover === "kleurvlak") {
    cover = (
      <div className={SHEET} style={body}>
        <div className="relative flex h-[62%] flex-col justify-between overflow-hidden p-[9%]" style={{ background: style.primaryColor }}>
          <div className="absolute -right-[18%] -top-[12%] h-[70%] w-[70%] rounded-full opacity-35" style={{ background: style.secondaryColor }} />
          <div className="absolute -right-[16%] top-[42%] h-[52%] w-[52%] rounded-full opacity-60" style={{ background: style.accentColor }} />
          <div className="relative">{logo(true)}</div>
          <div className="relative">
            <div className="mb-1 h-[3px] w-5" style={{ background: style.accentColor }} />
            <div className="text-[11px] font-bold leading-tight" style={{ ...heading, color: on }}>
              Financieel plan
            </div>
          </div>
        </div>
        <div className="p-[9%] text-[5px] text-ink-500">
          Opgesteld voor
          <div className="text-[7px] font-bold text-ink-900" style={heading}>
            Familie Voorbeeld
          </div>
        </div>
      </div>
    );
  } else if (blocks.cover === "zijbalk") {
    cover = (
      <div className={`${SHEET} flex`} style={body}>
        <div className="flex w-[36%] flex-col justify-between p-[6%]" style={{ background: style.primaryColor }}>
          {logo(true)}
          <div className="h-[2px] w-3" style={{ background: style.accentColor }} />
        </div>
        <div className="flex flex-1 flex-col justify-center p-[8%]">
          <div className="text-[4px] uppercase tracking-widest text-ink-400">Financieel plan</div>
          <div className="text-[9px] leading-tight text-ink-900" style={heading}>
            Plan 2026
          </div>
          <div className="my-1.5 h-px w-3" style={{ background: style.primaryColor }} />
          <div className="text-[5.5px] text-ink-700">Familie Voorbeeld</div>
        </div>
      </div>
    );
  } else if (blocks.cover === "licht") {
    cover = (
      <div className={`${SHEET} flex flex-col`} style={body}>
        <div className="flex flex-1 flex-col justify-between p-[10%]">
          {logo()}
          <div>
            <div className="text-[4px] uppercase tracking-widest" style={{ color: style.accentColor }}>
              Financieel plan
            </div>
            <div className="text-[11px] font-bold leading-tight" style={{ ...heading, color: style.primaryColor }}>
              Plan 2026
            </div>
            <div className="my-1.5 h-[2px] w-5" style={{ background: style.accentColor }} />
            <div className="text-[6px] text-ink-800">Familie Voorbeeld</div>
          </div>
          <div className="border-t border-ink-200 pt-1 text-[4px] text-ink-400">{firmName}</div>
        </div>
        <div className="flex h-[4%]">
          <div className="flex-[5]" style={{ background: style.primaryColor }} />
          <div className="flex-1" style={{ background: style.accentColor }} />
        </div>
      </div>
    );
  } else {
    // kader
    cover = (
      <div className={`${SHEET} p-[6%]`} style={{ ...body, background: style.primaryColor }}>
        <div className="flex h-full flex-col items-center justify-between border p-[8%] text-center" style={{ borderColor: style.accentColor }}>
          {logo(true)}
          <div>
            <div className="text-[4px] uppercase tracking-widest" style={{ color: style.accentColor }}>
              Financieel plan
            </div>
            <div className="text-[10px] font-bold" style={{ ...heading, color: on }}>
              Plan 2026
            </div>
            <div className="mx-auto my-1.5 h-px w-5" style={{ background: style.accentColor }} />
            <div className="text-[6px]" style={{ color: on }}>
              Familie Voorbeeld
            </div>
          </div>
          <div className="text-[4px]" style={{ color: tint(style.primaryColor, 0.6) }}>
            {firmName}
          </div>
        </div>
      </div>
    );
  }

  const opener = (nr: string, title: string) => {
    if (blocks.opener === "balk") {
      return (
        <div className="mb-1 flex items-end gap-1 rounded-[2px] px-1 py-[3px]" style={{ background: style.primaryColor }}>
          <span className="text-[8px] font-bold leading-none" style={{ ...heading, color: style.accentColor }}>
            {nr}
          </span>
          <span className="text-[6px] font-bold leading-none" style={{ ...heading, color: on }}>
            {title}
          </span>
        </div>
      );
    }
    if (blocks.opener === "hoofdstuk") {
      return (
        <div className="mb-1">
          <div className="text-[3.5px] uppercase tracking-widest text-ink-400">Hoofdstuk {nr}</div>
          <div className="text-[7px] leading-tight text-ink-900" style={heading}>
            {title}
          </div>
          <div className="mt-[2px] h-px w-2" style={{ background: style.primaryColor }} />
        </div>
      );
    }
    if (blocks.opener === "nummer") {
      return (
        <div className="mb-1 flex items-center gap-1">
          <span className="text-[11px] font-bold leading-none" style={{ ...heading, color: style.accentColor }}>
            {nr}
          </span>
          <span className="border-l border-ink-200 pl-1 text-[6px] font-bold" style={{ ...heading, color: style.primaryColor }}>
            {title}
          </span>
        </div>
      );
    }
    return (
      <div className="mb-1 flex items-end gap-1 border-b pb-0.5" style={{ borderColor: style.primaryColor }}>
        <span className="text-[4px]" style={{ ...heading, color: style.accentColor }}>
          {nr}
        </span>
        <span className="text-[7px] font-bold leading-none" style={{ ...heading, color: style.primaryColor }}>
          {title}
        </span>
      </div>
    );
  };

  const tile: React.CSSProperties =
    blocks.panel === "tint"
      ? { background: tint(style.primaryColor, 0.9), borderRadius: 2 }
      : blocks.panel === "kader"
        ? { background: "#fff", border: "0.5px solid #e3e6ea" }
        : { background: PAPER, borderLeft: `1.5px solid ${style.accentColor}` };

  const content = (
    <div className={`${SHEET} p-[9%]`} style={body}>
      {opener("01", "Samenvatting")}
      <div className="mb-1 space-y-[2px]">
        <div className="h-[2px] w-full bg-ink-200" />
        <div className="h-[2px] w-4/5 bg-ink-200" />
      </div>
      <div className="grid grid-cols-3 gap-[3px]">
        {["€ 2,2 mln", "€ 870k", "€ 1,4 mln", "€ 87k", "€ 9k", "31%"].map((v) => (
          <div key={v} className="px-[3px] py-[2px] text-[5px] font-bold" style={{ ...tile, ...heading, color: style.primaryColor }}>
            {v}
          </div>
        ))}
      </div>
      <div className="mt-2.5">{opener("02", "Vermogen")}</div>
      {[70, 45, 90].map((w, i) => (
        <div key={i} className="mb-[3px] flex items-center gap-1">
          <div className="h-[2px] w-1/4 bg-ink-200" />
          <div className="h-[5px] rounded-r-[1px]" style={{ width: `${w * 0.6}%`, background: style.primaryColor }} />
        </div>
      ))}
      <svg viewBox="0 0 100 34" className="mt-2 w-full">
        <polyline points="0,30 30,18 50,12 100,4" fill="none" stroke={style.accentColor} strokeWidth="1.2" />
        <polyline points="0,30 30,20 50,15 100,10" fill="none" stroke={style.primaryColor} strokeWidth="1.5" />
        <polyline points="0,30 30,22 50,19 100,17" fill="none" stroke={style.secondaryColor} strokeWidth="1.2" />
      </svg>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2 bg-ink-100 p-3" aria-hidden="true">
      {cover}
      {content}
    </div>
  );
}
