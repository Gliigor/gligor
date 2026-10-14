import { RegisterForm } from "../auth-forms";

export const metadata = { title: "Registreren" };

export default async function RegisterPage({ searchParams }: PageProps<"/registreren">) {
  const params = await searchParams;
  const invitedEmail = typeof params.uitnodiging === "string" ? params.uitnodiging.toLowerCase() : undefined;
  return (
    <>
      <h1 className="mb-2 text-[2.2rem] leading-tight">{invitedEmail ? "Uitnodiging accepteren" : "Kantoor registreren"}</h1>
      <p className="mb-6 text-sm text-ink-500">
        {invitedEmail
          ? "Maak je account aan. Je wordt automatisch aan het kantoor gekoppeld dat je heeft uitgenodigd."
          : "Maak een account aan voor jouw kantoor."}
      </p>
      <RegisterForm invitedEmail={invitedEmail} />
    </>
  );
}
