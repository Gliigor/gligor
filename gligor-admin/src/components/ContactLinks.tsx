import { Mail, MessageCircle, Phone } from "lucide-react";
import { phoneLinks } from "@/lib/format";
import type { Channel } from "@/lib/config";

/** Bellen / WhatsApp / mailen, met het voorkeurskanaal van de klant als eerste (en opvallend). */
export function ContactLinks({ phone, email, channel, size = "sm" }: { phone: string | null; email: string | null; channel: Channel; size?: "sm" | "md" }) {
  const links = phoneLinks(phone);
  const items = [
    links && { key: "telefoon" as Channel, href: links.tel, label: "Bel", icon: Phone },
    links && { key: "whatsapp" as Channel, href: links.whatsapp, label: "WhatsApp", icon: MessageCircle },
    email && { key: "email" as Channel, href: `mailto:${email}`, label: "Mail", icon: Mail },
  ].filter(Boolean) as { key: Channel; href: string; label: string; icon: typeof Phone }[];
  items.sort((a, b) => (a.key === channel ? -1 : b.key === channel ? 1 : 0));
  const cls = size === "sm" ? "btn btn-sm" : "btn";
  return (
    <>
      {items.map((i, idx) => (
        <a
          key={i.key}
          href={i.href}
          target={i.key === "whatsapp" ? "_blank" : undefined}
          rel="noreferrer"
          className={`${cls} ${idx === 0 ? "" : "btn-ghost"}`}
          title={i.key === channel ? `${i.label} (voorkeur)` : i.label}
        >
          <i.icon className="size-3.5" strokeWidth={1.75} />
          {idx === 0 && i.label}
        </a>
      ))}
    </>
  );
}
