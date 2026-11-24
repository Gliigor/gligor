/**
 * Contactformulier: verstuurt met fetch naar het dashboard en toont het resultaat
 * op de pagina. Zonder JavaScript werkt het formulier gewoon (doorsturen naar /bedankt).
 */
export function initContactForm() {
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  if (!form) return;
  const status = form.querySelector<HTMLElement>("[data-contact-status]")!;
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;

  const show = (text: string, ok: boolean) => {
    status.textContent = text;
    status.classList.remove("hidden", "text-red-600", "text-teal");
    status.classList.add(ok ? "text-teal" : "text-red-600");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    button.disabled = true;
    const label = button.innerHTML;
    button.textContent = "Versturen…";
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        form.reset();
        show("Dank je wel! Je bericht is binnen. Ik reageer binnen één werkdag.", true);
      } else {
        show(data.error ?? "Versturen lukte niet. Mail of app me gerust direct.", false);
      }
    } catch {
      show("Versturen lukte niet. Mail of app me gerust direct.", false);
    } finally {
      button.disabled = false;
      button.innerHTML = label;
    }
  });
}
