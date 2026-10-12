import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export const metadata = { title: "Inloggen" };

const NOTICES: Record<string, string> = {
  "link-ongeldig": "Deze link is verlopen of al gebruikt. Log in of vraag een nieuwe link aan.",
  uitgelogd: "Je bent uitgelogd.",
};

export default async function LoginPage({ searchParams }: PageProps<"/inloggen">) {
  const params = await searchParams;
  if (await getAuthUserId()) redirect("/clienten");
  const melding = typeof params.melding === "string" ? NOTICES[params.melding] : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Inloggen</h1>
      <p className="mb-6 text-sm text-ink-500">Welkom terug bij Plannr.</p>
      <LoginForm next={next} notice={melding} />
      <p className="mt-6 text-center text-sm text-ink-500">
        Nog geen account?{" "}
        <Link href="/registreren" className="font-medium text-brand-600 hover:underline">
          Kantoor registreren
        </Link>
      </p>
    </>
  );
}
