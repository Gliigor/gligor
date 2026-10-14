import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-night p-12 text-ink-50 lg:flex">
        <Logo tone="light" />
        <div className="max-w-md">
          <div className="mb-6 h-px w-14 bg-gold-500" />
          <p className="font-display text-[2.6rem] font-medium leading-[1.12]">
            Financiële planning voor ondernemers met vermogen.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Van IB-aangifte en jaarrekening tot een rapport in de huisstijl van uw kantoor — in één heldere werkwijze.
          </p>
        </div>
        <p className="text-xs text-white/40">Prototype · berekeningen zijn indicatief en niet geschikt als advies.</p>
        <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[0.12]">
          <circle cx="200" cy="200" r="199" fill="none" stroke="#a8834b" />
          <circle cx="200" cy="200" r="150" fill="none" stroke="#a8834b" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="#a8834b" />
        </svg>
      </section>
      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="mt-8 max-w-sm text-center text-xs text-ink-400 lg:hidden">
          Plannr is een prototype. Berekeningen zijn indicatief en niet geschikt als advies.
        </p>
      </section>
    </main>
  );
}
