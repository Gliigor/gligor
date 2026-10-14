// Renders the report to a PDF buffer. Usable from Next.js route handlers and
// from plain Node scripts (the seed script), so it must not import server-only.

import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { FONT_OPTIONS } from "@/lib/house-style/fonts";
import type { HouseStyle } from "@/lib/house-style/types";
import { ReportDocument, type ReportData, type ReportLogo } from "./report";

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  for (const f of FONT_OPTIONS) {
    Font.register({
      family: f.name,
      fonts: [
        { src: path.join(dir, `${f.file}-400.woff`), fontWeight: 400 },
        { src: path.join(dir, `${f.file}-700.woff`), fontWeight: 700 },
      ],
    });
  }
  // Dutch words must not be hyphenated with English rules.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export async function renderReportPdf(data: ReportData, style: HouseStyle, logo?: ReportLogo | null): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ReportDocument data={data} style={style} logo={logo} />);
}

/** Detects PNG/JPEG from magic bytes (logos are restricted to these types). */
export function toReportLogo(bytes: ArrayBuffer | Buffer | null | undefined): ReportLogo | null {
  if (!bytes) return null;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return { data: buf, format: "png" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return { data: buf, format: "jpg" };
  return null;
}
