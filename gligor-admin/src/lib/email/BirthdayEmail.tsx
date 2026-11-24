/**
 * Opgemaakte verjaardagsmail (React Email), getest in de stijl van gligor.ai.
 * De tekst zelf komt uit het sjabloon "verjaardag" (aan te passen in Templates);
 * dit bestand bepaalt alleen de vormgeving. Kleuren staan bovenaan om makkelijk te wijzigen.
 */
import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";

const COLORS = {
  navy: "#0f2a4a",
  accent: "#2563eb",
  teal: "#14b8a6",
  ink: "#334155",
  mist: "#f8fafc",
  line: "#e2e8f0",
};
const LOGO_URL = "https://gligor.ai/icon-192.png";
const FONT = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Confetti als gekleurde bolletjes in een tabel: werkt ook in Outlook, zonder afbeeldingen. */
const CONFETTI = [COLORS.accent, COLORS.teal, "#fbbf24", COLORS.accent, "#f472b6", COLORS.teal, "#fbbf24", COLORS.accent];

export function BirthdayEmail({ firstName, body }: { firstName: string; body: string }) {
  const paragraphs = body.trim().split(/\n{2,}/);
  return (
    <Html lang="nl">
      <Head />
      <Preview>{`Gefeliciteerd, ${firstName}!`}</Preview>
      <Body style={{ backgroundColor: COLORS.mist, margin: 0, padding: "24px 0", fontFamily: FONT }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", border: `1px solid ${COLORS.line}` }}>
          <Section style={{ backgroundColor: COLORS.navy, padding: "28px 32px 24px", textAlign: "center" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto 18px" }}>
              <tbody>
                <tr>
                  {CONFETTI.map((c, i) => (
                    <td key={i} style={{ padding: "0 5px" }}>
                      <div style={{ width: i % 3 === 0 ? 10 : 7, height: i % 3 === 0 ? 10 : 7, borderRadius: 999, backgroundColor: c }} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <Text style={{ margin: 0, fontSize: 40, lineHeight: "48px" }}>🎉</Text>
            <Text style={{ margin: "10px 0 0", fontSize: 26, lineHeight: "32px", fontWeight: 800, color: "#ffffff" }}>
              Gefeliciteerd, {firstName}!
            </Text>
          </Section>
          <Section style={{ padding: "28px 32px 8px" }}>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ margin: "0 0 14px", fontSize: 15, lineHeight: "24px", color: COLORS.ink, whiteSpace: "pre-line" }}>
                {p}
              </Text>
            ))}
          </Section>
          <Section style={{ padding: "8px 32px 28px", borderTop: `1px solid ${COLORS.line}` }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ marginTop: 16 }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: 12, verticalAlign: "middle" }}>
                    <Img src={LOGO_URL} width={36} height={36} alt="Gligor.ai" style={{ borderRadius: 8 }} />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.navy }}>Gligor Jancev</Text>
                    <Text style={{ margin: 0, fontSize: 13, color: COLORS.ink }}>
                      gligor<span style={{ color: COLORS.teal, fontStyle: "italic" }}>.ai</span> · gligor@gligor.ai
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** HTML plus platte-tekstversie voor de verjaardagsmail. */
export async function renderBirthdayEmail(opts: { firstName: string; body: string }): Promise<{ html: string; text: string }> {
  const html = await render(<BirthdayEmail {...opts} />);
  return { html, text: opts.body };
}
