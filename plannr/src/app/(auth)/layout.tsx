import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-ink-900">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-400">
        Plannr is een prototype. Berekeningen zijn indicatief en niet geschikt als advies.
      </p>
    </main>
  );
}
