"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Kopieert tekst (bijv. een adres voor een kaartje) naar het klembord. */
export function CopyButton({ text, label = "Kopiëren" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      title={text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Kopieer dit adres:", text);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Gekopieerd" : label}
    </button>
  );
}
