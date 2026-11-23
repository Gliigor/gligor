"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="tile mx-auto mt-10 max-w-lg p-6">
      <h1 className="text-lg font-semibold">Er ging iets mis</h1>
      <p className="mt-2 text-muted">{error.message || "Onbekende fout."}</p>
      <button type="button" className="btn mt-4" onClick={reset}>
        Opnieuw proberen
      </button>
    </div>
  );
}
