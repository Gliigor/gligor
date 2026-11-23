import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gligor.ai admin", template: "%s · Gligor.ai admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="nl" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
