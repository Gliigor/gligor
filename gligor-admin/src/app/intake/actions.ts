"use server";

import { redirect } from "next/navigation";
import { withSystem } from "@/lib/db";
import { intakeSchema } from "@/lib/domain/leads";
import { submitIntakeLink } from "@/lib/services/leads";
import type { ActionState } from "@/app/actions";

/** Publiek: de klant vult het intakeformulier in via de eenmalige link. */
export async function submitPublicIntakeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? "");
  if (!/^[\w-]{20,64}$/.test(token)) return { error: "Deze link klopt niet." };
  const parsed = intakeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controleer het formulier." };
  try {
    await withSystem((q) => submitIntakeLink(q, token, parsed.data, new Date()));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Er ging iets mis." };
  }
  redirect(`/intake/${token}`);
}
