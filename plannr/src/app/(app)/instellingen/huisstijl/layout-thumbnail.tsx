// Lightweight HTML impression of a report layout (cover + first content page).
// Mirrors src/lib/pdf/report.tsx; "Volledig bekijken" opens the real PDF.

import type { HouseStyle } from "@/lib/house-style/types";
import type { LayoutVariant } from "@/lib/plan/types";

function tint(hex: string, amount: number) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#f3f4f6";
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const SHEET = "relative aspect-[210/297] w-full overflow-hidden rounded-sm bg-white shadow ring-1 ring-ink-200";

export function LayoutThumbnail({
  variant,
  style,
  firmName,
  logoUrl,
}: {
  variant: LayoutVariant;
  style: HouseStyle;
  firmName: string;
  logoUrl: string | null;
}) {
  const heading = { fontFamily: `"${style.fontHeading}"` };
  const body = { fontFamily: `"${style.fontBody}"` };
  const logo = (light = false) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={`max-h-4 max-w-[60%] object-contain ${light ? "rounded-sm bg-white p-0.5" : ""}`} />
    ) : (
      <span className="text-[7px] font-bold" style={{ ...heading, color: light ? "#fff" : style.primaryColor }}>
        {firmName}
      </span>
    );

  let cover: React.ReactNode;
  if (variant === "modern") {
    cover = (
      <div className={SHEET} style={body}>
        <div className="flex h-[58%] flex-col justify-between p-[9%]" style={{ background: style.primaryColor }}>
          {logo(true)}
          <div>
            <div className="mb-1 h-[3px] w-5" style={{ background: style.accentColor }} />
            <div className="text-[11px] font-bold leading-tight text-white" style={heading}>
              Financieel plan
            </div>
            <div className="text-[6px]" style={{ color: tint(style.primaryColor, 0.7) }}>
              Plan 2026
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
  } else if (variant === "minimalistisch") {
    cover = (
      <div className={`${SHEET} flex flex-col justify-between p-[12%]`} style={body}>
        {logo()}
        <div>
          <div className="text-[10px] leading-tight text-ink-900" style={heading}>
            Plan 2026
          </div>
          <div className="my-1.5 h-px w-3" style={{ background: style.primaryColor }} />
          <div className="text-[5.5px] text-ink-700">Familie Voorbeeld</div>
        </div>
        <div className="text-[4.5px] text-ink-400">{firmName}</div>
      </div>
    );
  } else {
    cover = (
      <div className={`${SHEET} p-[10%]`} style={body}>
        <div className="border-b pb-1" style={{ borderColor: style.primaryColor }}>
          {logo()}
        </div>
        <div className="mt-[38%] text-center">
          <div className="text-[4.5px] uppercase tracking-widest text-ink-500">Financieel plan</div>
          <div className="text-[10px] font-bold" style={{ ...heading, color: style.primaryColor }}>
            Plan 2026
          </div>
          <div className="mx-auto my-1.5 h-[2px] w-5" style={{ background: style.accentColor }} />
          <div className="text-[6px] text-ink-800">Familie Voorbeeld</div>
        </div>
      </div>
    );
  }

  const h2: React.CSSProperties =
    variant === "klassiek"
      ? { ...heading, color: style.primaryColor, borderBottom: `1px solid ${style.primaryColor}`, fontSize: 7, fontWeight: 700 }
      : variant === "modern"
        ? { ...heading, color: style.primaryColor, borderLeft: `2px solid ${style.accentColor}`, paddingLeft: 3, fontSize: 7, fontWeight: 700 }
        : { ...heading, color: style.primaryColor, fontSize: 5, letterSpacing: 1, textTransform: "uppercase" };
  const tileBg = variant === "modern" ? tint(style.primaryColor, 0.9) : variant === "klassiek" ? "#f7f7f5" : "#fff";

  const content = (
    <div className={`${SHEET} p-[9%]`} style={body}>
      <div className="mb-1 pb-0.5" style={h2}>
        Samenvatting
      </div>
      <div className="mb-1 space-y-[2px]">
        <div className="h-[2px] w-full bg-ink-200" />
        <div className="h-[2px] w-4/5 bg-ink-200" />
      </div>
      <div className="grid grid-cols-3 gap-[3px]">
        {["€ 2,2 mln", "€ 870k", "€ 1,4 mln", "€ 87k", "€ 9k", "31%"].map((v) => (
          <div
            key={v}
            className="rounded-[2px] px-[3px] py-[2px] text-[5px] font-bold"
            style={{ background: tileBg, color: variant === "minimalistisch" ? "#1f2328" : style.primaryColor, border: variant === "minimalistisch" ? "0.5px solid #e3e6ea" : undefined }}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="mb-1 mt-2.5 pb-0.5" style={h2}>
        Vermogensoverzicht
      </div>
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
