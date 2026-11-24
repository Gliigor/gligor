/**
 * Alles wat Gligor zelf nog moet invullen staat hier op één plek.
 * Pas deze waarden aan en bouw de site opnieuw (`npm run build`).
 */

/** Cal.com-link: gebruikersnaam/evenement, zonder https://cal.com/ ervoor. */
export const CAL_LINK = "gligorjancev/kennismaking";

export const CONTACT = {
  email: "gligorjancev@gmail.com",
  /** WhatsApp-nummer in internationaal formaat, alleen cijfers (31 = Nederland). */
  whatsapp: "31628607702",
  /** Het nummer zoals bezoekers het lezen. */
  whatsappDisplay: "06 28 60 77 02",
  linkedin: "https://www.linkedin.com/in/gligor-jancev-889801299/",
};

/** Het contactformulier stuurt berichten naar het dashboard (als lead met een taak "Reageren binnen 1 werkdag"). */
export const LEAD_ENDPOINT = "https://admin.gligor.ai/api/leads";

export const BUSINESS = {
  name: "Gligor.ai",
  /** Juridische naam zoals ingeschreven bij de KvK (eenmanszaak). */
  legalName: "Gligor Jancev",
  /** Lege velden worden op de site niet getoond. Vul ze in zodra de KvK-inschrijving rond is. */
  street: "",
  postalCity: "",
  kvk: "",
  btw: "",
};

export const PRICE_PER_MONTH = 100;

/** Eenmalig startbedrag (inrichting + starttraining), excl. btw. */
export const START_FEE = 250;
/** Tijdbespaargarantie: minimaal zoveel uur besparing in de eerste maand, anders startbedrag terug. */
export const GUARANTEE_HOURS = 4;

/** Voorbereid voor later: zet op true zodra er een introvideo is. */
export const SHOW_INTRO_VIDEO = false;
/** YouTube/Vimeo-embedlink of pad naar een mp4 in /public. */
export const INTRO_VIDEO_URL = "";

/** Voorbereid voor later: tool-logo's, certificaten en reviews. */
export const SHOW_TRUST_SECTION = false;

/** Persoonlijke zin onderaan "Over mij". Laat leeg om weg te laten. */
export const ABOUT_PERSONAL_LINE = "[persoonlijke zin invullen]";
