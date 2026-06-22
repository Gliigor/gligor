import React, { useEffect, useState } from "react";

/**
 * Lead Automation — standalone landing page for gligor.xyz
 * Route: /#/lead-automation  (HashRouter — see App.tsx)
 *
 * Deliberately light/editorial — a separate premium look from the dark portfolio.
 * All styles are scoped under `.la-root` so they never touch the rest of the site,
 * and the page loads its own webfonts on mount (Cormorant Garamond / Hanken Grotesk
 * / JetBrains Mono) without altering the global index.css.
 */

const BEHANDELINGEN_MAP: Record<string, number> = {
  "Knippen": 25,
  "Knippen + föhnen": 35,
  "Kleuren": 65,
  "Föhnen": 20,
  "Knippen (heren)": 18,
};
const BEHANDELINGEN = Object.keys(BEHANDELINGEN_MAP);

const MOCK_SLOTS = ["09:00", "09:30", "10:30", "11:00", "14:00", "15:30"];

export default function LeadAutomation() {
  // Form fields
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [behandeling, setBehandeling] = useState("Knippen");
  const [datum, setDatum] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [opmerkingen, setOpmerkingen] = useState("");

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  // Availability state
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  // Smooth-scroll helper — prevents HashRouter from interpreting #id as a route
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // Load page-specific webfonts without touching global index.css
  useEffect(() => {
    const id = "la-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }
    // Reveal-on-scroll
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".la-root .reveal, .la-root .step").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Fetch availability whenever datum or behandeling changes
  useEffect(() => {
    if (!datum) {
      setAvailableSlots([]);
      setSelectedSlot("");
      setSlotsLoaded(false);
      setSlotsError("");
      return;
    }

    setSlotsLoaded(false);
    setAvailableSlots([]);
    setSelectedSlot("");
    setSlotsError("");
    setSlotsLoading(true);

    const availabilityUrl = import.meta.env.VITE_MAKE_AVAILABILITY_WEBHOOK_URL as string | undefined;

    if (!availabilityUrl) {
      // Mock mode
      setTimeout(() => {
        setAvailableSlots(MOCK_SLOTS);
        setSlotsLoading(false);
        setSlotsLoaded(true);
      }, 700);
      return;
    }

    fetch(availabilityUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: datum,
        client_id: "mk-kapsalon",
        treatment_name: behandeling,
        treatment_price: BEHANDELINGEN_MAP[behandeling] ?? 25,
      }),
    })
      .then((r) => r.json())
      .then((data: { available_slots?: string[] }) => {
        setAvailableSlots(data.available_slots ?? []);
        setSlotsLoaded(true);
      })
      .catch(() => {
        setSlotsError("Kon beschikbare tijden niet ophalen. Probeer een andere datum.");
      })
      .finally(() => setSlotsLoading(false));
  }, [datum, behandeling]);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);

    const bookingUrl = import.meta.env.VITE_MAKE_BOOKING_WEBHOOK_URL as string | undefined;

    const payload = {
      first_name: voornaam,
      last_name: achternaam,
      phone: telefoon,
      email,
      treatment_name: behandeling,
      treatment_price: BEHANDELINGEN_MAP[behandeling] ?? 25,
      date: datum,
      time: selectedSlot,
      notes: opmerkingen,
      source: "gligor-lead-automation-demo",
      client_id: "mk-kapsalon",
    };

    if (bookingUrl) {
      try {
        await fetch(bookingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // fail silently in demo
      }
    } else {
      // Mock: save to localStorage
      try {
        const existing = JSON.parse(localStorage.getItem("la-aanvragen") || "[]");
        existing.push({ ...payload, id: `aanvraag-${Date.now()}`, timestamp: new Date().toISOString() });
        localStorage.setItem("la-aanvragen", JSON.stringify(existing));
      } catch {
        // localStorage may be unavailable
      }
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="la-root">
      <style>{CSS}</style>

      {/* ===== HERO ===== */}
      <section className="la-hero" id="top">
        <div className="la-wrap la-hero-grid">
          <div>
            <span className="eyebrow reveal">Lead Automation</span>
            <h1 className="hero-title reveal d1">Nooit meer klantaanvragen kwijtraken.</h1>
            <p className="hero-sub reveal d2">
              Ik bouw slimme intake- en opvolgflows voor lokale ondernemers, zodat aanvragen
              automatisch worden geregistreerd, bevestigd en overzichtelijk opgevolgd.
            </p>
            <div className="hero-actions reveal d3">
              <a href="#contact" className="btn btn-primary" onClick={scrollTo("contact")}>
                Vraag een gratis processcan aan <span className="arrow">→</span>
              </a>
              <a href="#demo" className="btn btn-ghost" onClick={scrollTo("demo")}>Bekijk de demo</a>
            </div>
            <div className="hero-meta reveal d3">
              <div className="stat"><div className="n">1 plek</div><div className="l">Alle aanvragen, overzichtelijk</div></div>
              <div className="stat"><div className="n">24/7</div><div className="l">Automatische bevestiging</div></div>
              <div className="stat"><div className="n">0</div><div className="l">Gemiste aanvragen</div></div>
            </div>
          </div>

          <div className="hero-panel reveal d2">
            <div className="note-card animate-float">
              <div className="note-top">
                <div className="note-avatar">S</div>
                <div>
                  <div className="note-app">nieuwe-aanvraag · demo kapsalon</div>
                  <div className="note-name">Sara de Vries</div>
                </div>
                <span className="ai-tag">AI</span>
              </div>
              <div className="note-body">
                <div className="row"><span className="k">Behandeling</span><span className="v">Knippen + föhnen</span></div>
                <div className="row"><span className="k">Datum</span><span className="v">Vrijdag 4 juli · 10:30</span></div>
                <div className="row"><span className="k">Status</span><span className="v">Bevestigd</span></div>
              </div>
              <div className="note-foot"><span className="pulse" /> Actie: afspraak staat in agenda</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST ===== */}
      <div className="trust">
        <div className="la-wrap trust-row reveal">
          <span className="label">Van versnipperd naar één flow</span>
          <div className="channels">
            <span className="channel">Telefoon</span>
            <span className="channel">WhatsApp</span>
            <span className="channel">Instagram DM</span>
            <span className="channel">E-mail</span>
            <span className="channel" style={{ color: "var(--la-accent)", fontWeight: 600 }}>→ Eén overzicht</span>
          </div>
        </div>
      </div>

      {/* ===== WERKWIJZE ===== */}
      <section className="block" id="werkwijze">
        <div className="la-wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Hoe het werkt</span>
            <h2 className="sec-title">Eén rustige flow, van aanvraag tot opvolging.</h2>
            <p className="lead">
              Geen losse telefoontjes, DM's en mailtjes meer. De klant doorloopt een korte intake — de
              rest gebeurt automatisch, op de achtergrond.
            </p>
          </div>
          <div className="steps">
            {[
              ["01", "Klant vult in", "Een kort, helder intakeformulier op je site of via een link. Geen account nodig."],
              ["02", "Aanvraag opgeslagen", "Elke aanvraag wordt netjes geregistreerd in één overzicht — niets raakt kwijt."],
              ["03", "Klant krijgt bevestiging", "Automatisch een nette bevestiging, zodat de klant weet dat het goed zit."],
              ["04", "Jij krijgt melding", "Een duidelijke melding op het moment dat er een nieuwe aanvraag binnenkomt."],
              ["05", "AI-samenvatting", "Een korte samenvatting per aanvraag, met een concrete vervolgactie."],
            ].map(([num, title, body], i) => (
              <div className={`step reveal${i > 0 ? " d" + Math.min(i, 3) : ""}`} key={num}>
                <span className="bar" />
                <div className="num">{num}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WAT IK BOUW ===== */}
      <section className="block surface" id="wat">
        <div className="la-wrap feat-wrap">
          <div className="feat-aside reveal">
            <span className="eyebrow">Wat ik bouw</span>
            <p className="quote">
              "Niet om persoonlijk contact te vervangen — om aanvragen sneller, overzichtelijker en
              consistenter op te volgen."
            </p>
            <div className="guarantee">
              <div className="gt">
                <ShieldIcon /> Bug-garantie
              </div>
              <div className="gd">
                Werkt iets niet zoals afgesproken na oplevering? Dan los ik het op. Je krijgt een werkende
                flow, geen half product.
              </div>
            </div>
          </div>

          <div className="feat-list">
            {FEATURES.map(([Icon, t, d], i) => (
              <div className={`feat reveal${i % 2 ? " d1" : ""}`} key={t as string}>
                <div className="ic">{Icon}</div>
                <div>
                  <div className="ft">{t}</div>
                  <div className="fd">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DEMO CASE ===== */}
      <section className="block demo" id="demo">
        <div className="la-wrap">
          <div className="sec-head reveal" style={{ marginBottom: 48 }}>
            <span className="case-tag"><span className="badge" /> Demo-case · MK Kapsalon</span>
            <h2 className="sec-title" style={{ marginTop: 22 }}>Van losse appjes naar één afspraakflow.</h2>
            <p className="lead">
              Klanten kiezen een datum, zien direct beschikbare tijden en boeken in één stap.
              Vul het formulier in en zie wat er daarna automatisch gebeurt.
            </p>
          </div>

          <div className="demo-grid">
            {/* intake form */}
            <div className="form-card reveal">
              <div className="fc-top">
                <span className="dots">
                  <i style={{ background: "#E5A5A0" }} /><i style={{ background: "#E9C98A" }} /><i style={{ background: "#A9CDA0" }} />
                </span>
                <span className="fc-url">demo · afspraak boeken</span>
              </div>
              <div className="fc-body">
                <h3>Afspraak boeken</h3>
                <p className="fc-sub">Kies je behandeling, datum en tijdslot — we bevestigen automatisch.</p>
                <form onSubmit={handleDemoSubmit}>
                  <div className="two">
                    <div className="field">
                      <label>Voornaam</label>
                      <input
                        type="text"
                        value={voornaam}
                        onChange={(e) => setVoornaam(e.target.value)}
                        placeholder="Sara"
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Achternaam</label>
                      <input
                        type="text"
                        value={achternaam}
                        onChange={(e) => setAchternaam(e.target.value)}
                        placeholder="de Vries"
                        required
                      />
                    </div>
                  </div>
                  <div className="two">
                    <div className="field">
                      <label>Telefoonnummer</label>
                      <input
                        type="tel"
                        value={telefoon}
                        onChange={(e) => setTelefoon(e.target.value)}
                        placeholder="06 12 34 56 78"
                        required
                      />
                    </div>
                    <div className="field">
                      <label>E-mailadres</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="sara@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Gewenste behandeling</label>
                    <div className="chips">
                      {BEHANDELINGEN.map((b) => (
                        <button type="button" key={b} className={`chip${behandeling === b ? " on" : ""}`} onClick={() => setBehandeling(b)}>{b}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Datum</label>
                    <input
                      type="date"
                      value={datum}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDatum(e.target.value)}
                      required
                    />
                  </div>

                  {/* ===== TIJDSLOT SECTIE ===== */}
                  {datum && (
                    <div className="field slot-section">
                      <label>Beschikbare tijden</label>
                      {slotsLoading && (
                        <div className="slot-loading">
                          <span className="slot-spinner" />
                          Beschikbare tijden laden…
                        </div>
                      )}
                      {!slotsLoading && slotsError && (
                        <div className="slot-error">{slotsError}</div>
                      )}
                      {!slotsLoading && slotsLoaded && availableSlots.length === 0 && (
                        <div className="slot-empty">
                          Geen beschikbare tijden op deze datum. Kies een andere dag.
                        </div>
                      )}
                      {!slotsLoading && slotsLoaded && availableSlots.length > 0 && (
                        <div className="slots">
                          {availableSlots.map((slot) => (
                            <button
                              type="button"
                              key={slot}
                              className={`slot-btn${selectedSlot === slot ? " selected" : ""}`}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="field">
                    <label>Opmerkingen <span className="opt">(optioneel)</span></label>
                    <textarea
                      rows={2}
                      value={opmerkingen}
                      onChange={(e) => setOpmerkingen(e.target.value)}
                      placeholder="Bv. allergie voor bepaald product, voorkeur voor kapper…"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary fc-submit"
                    disabled={!datum || !selectedSlot || submitting}
                    style={{ opacity: (!datum || !selectedSlot) ? 0.5 : 1, cursor: (!datum || !selectedSlot) ? "not-allowed" : "pointer" }}
                  >
                    {submitting ? "Bezig met boeken…" : <>Afspraak bevestigen <span className="arrow">→</span></>}
                  </button>
                  {datum && !selectedSlot && slotsLoaded && availableSlots.length > 0 && (
                    <p className="slot-hint">Kies een tijdslot om te boeken.</p>
                  )}
                </form>
              </div>
            </div>

            {/* result */}
            <div>
              <div className="case-tag" style={{ marginBottom: 18 }}><span className="badge" /> Wat er automatisch gebeurt</div>
              <div className="result-stack">
                {!submitted && (
                  <div className="demo-placeholder">Boek een afspraak links om de automatische flow te zien →</div>
                )}

                <div className={`result-card r1${submitted ? " show" : ""}`}>
                  <div className="rc-head">
                    <div className="rc-ic green"><CheckIcon /></div>
                    <div><div className="rc-title">Klant krijgt bevestiging</div><div className="rc-meta">automatisch · &lt; 1 sec</div></div>
                  </div>
                  <div className="rc-body">
                    Bedankt <strong>{voornaam || "Klant"}</strong>! Je afspraak voor <strong>{behandeling.toLowerCase()}</strong> op <strong>{datum}</strong> om <strong>{selectedSlot}</strong> is bevestigd.
                    {email && <><br /><span style={{ color: "var(--la-muted)", fontSize: 13 }}>Bevestiging gestuurd naar {email}</span></>}
                  </div>
                </div>

                <div className={`result-card r2${submitted ? " show" : ""}`}>
                  <div className="rc-head">
                    <div className="rc-ic dark"><BellIcon /></div>
                    <div><div className="rc-title">Afspraak in agenda gezet</div><div className="rc-meta">Google Calendar · demo kapsalon</div></div>
                  </div>
                  <div className="rc-body">
                    Het evenement staat automatisch in de agenda van de kapsalon. Geen handmatig plannen meer.
                    <div className="storage-note">
                      <span className="storage-icon"><DocIcon /></span>
                      In productie: afspraak gaat direct naar Google Calendar + je krijgt een melding.
                    </div>
                  </div>
                </div>

                <div className={`result-card r3${submitted ? " show" : ""}`}>
                  <div className="rc-head">
                    <div className="rc-ic green"><SparkIcon /></div>
                    <div><div className="rc-title">AI-samenvatting</div><div className="rc-meta">voor de ondernemer</div></div>
                    <span className="ai-tag" style={{ marginLeft: "auto" }}>AI</span>
                  </div>
                  <div className="rc-body ai-summary">
                    <div className="row"><span className="k">Klant</span><span className="v">{voornaam} {achternaam}</span></div>
                    {email && <div className="row"><span className="k">E-mail</span><span className="v">{email}</span></div>}
                    {telefoon && <div className="row"><span className="k">Telefoon</span><span className="v">{telefoon}</span></div>}
                    <div className="row"><span className="k">Behandeling</span><span className="v">{behandeling}</span></div>
                    <div className="row"><span className="k">Datum & tijd</span><span className="v">{datum} · {selectedSlot}</span></div>
                    {opmerkingen && <div className="row"><span className="k">Opmerking</span><span className="v">{opmerkingen}</span></div>}
                    <div className="ai-action">
                      <span className="pulse" />
                      Actie: afspraak bevestigd · klant ontvangt mail
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RESULTATEN ===== */}
      <section className="block" id="resultaten">
        <div className="la-wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Het resultaat</span>
            <h2 className="sec-title">Rust in je opvolging.</h2>
          </div>
          <div className="stats-grid reveal">
            <div className="stat-cell"><div className="sn">1<span className="u"> plek</span></div><div className="sl">Alle aanvragen samengebracht in één overzicht.</div></div>
            <div className="stat-cell"><div className="sn">24/7</div><div className="sl">Aanvragen en bevestigingen lopen ook buiten openingstijden door.</div></div>
            <div className="stat-cell"><div className="sn">&lt;1<span className="u"> min</span></div><div className="sl">Van binnenkomst tot leesbare samenvatting met vervolgactie.</div></div>
            <div className="stat-cell"><div className="sn">0</div><div className="sl">Aanvragen die nog ergens tussen je appjes verdwijnen.</div></div>
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className="block contact" id="contact">
        <div className="la-wrap contact-grid">
          <div className="reveal">
            <span className="eyebrow">Gratis processcan</span>
            <h2 className="sec-title">Vraag een gratis processcan aan.</h2>
            <p className="lead">
              Ik kijk vrijblijvend naar je huidige aanvraagproces en laat zien welke stappen je kunt
              automatiseren. Geen verplichtingen — gewoon een helder beeld.
            </p>
            <div className="contact-points">
              <div className="cpoint"><span className="cic"><ChatIcon /></span><div><div className="ct">We bekijken je huidige proces</div><div className="cd">Telefoon, WhatsApp, DM's en mail — waar lopen aanvragen nu binnen?</div></div></div>
              <div className="cpoint"><span className="cic"><BulbIcon /></span><div><div className="ct">Je krijgt concrete suggesties</div><div className="cd">Welke stappen kunnen automatisch — en wat dat je oplevert.</div></div></div>
              <div className="cpoint"><span className="cic"><ArrowIcon /></span><div><div className="ct">Geen verplichtingen</div><div className="cd">Je beslist daarna zelf of en wanneer je verder wilt.</div></div></div>
            </div>
          </div>

          <div className="contact-card reveal d1">
            {!contactSent ? (
              <form onSubmit={(e) => { e.preventDefault(); setContactSent(true); }}>
                <div className="two">
                  <div className="field"><label>Naam</label><input type="text" placeholder="Voor- en achternaam" required /></div>
                  <div className="field"><label>Bedrijf</label><input type="text" placeholder="Naam van je zaak" /></div>
                </div>
                <div className="two">
                  <div className="field"><label>E-mail</label><input type="email" placeholder="jij@bedrijf.nl" required /></div>
                  <div className="field"><label>Telefoon</label><input type="tel" placeholder="06 12 34 56 78" /></div>
                </div>
                <div className="field"><label>Hoe lopen aanvragen nu binnen?</label><textarea rows={3} placeholder="Bv. telefoon en WhatsApp, soms Instagram DM…" /></div>
                <button type="submit" className="btn btn-primary">Vraag de gratis processcan aan <span className="arrow">→</span></button>
                <p className="form-note">Ik reageer doorgaans binnen één werkdag. Geen verplichtingen.</p>
              </form>
            ) : (
              <div className="thanks">
                <div className="tk-ic"><CheckIcon /></div>
                <h3>Bedankt — aanvraag ontvangen.</h3>
                <p>Ik kijk naar je proces en neem snel contact op met een paar concrete suggesties.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="final">
        <div className="la-wrap">
          <span className="eyebrow center reveal" style={{ justifyContent: "center" }}>Klaar om aanvragen los te laten?</span>
          <h2 className="reveal d1">Laat geen enkele klant meer tussen je appjes verdwijnen.</h2>
          <p className="reveal d2">Eén rustige flow die aanvragen registreert, bevestigt en samenvat — zodat jij je op je vak kunt richten.</p>
          <div className="reveal d2" style={{ display: "flex", justifyContent: "center" }}>
            <a href="#contact" className="btn btn-primary" onClick={scrollTo("contact")}>
              Vraag een gratis processcan aan <span className="arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="la-footer">
        <div className="la-wrap foot-row">
          <span className="fl">© {new Date().getFullYear()} gligor.xyz — Lead Automation</span>
          <div className="foot-links">
            <a href="/#/">Terug naar gligor.xyz</a>
            <a href="#werkwijze" onClick={scrollTo("werkwijze")}>Werkwijze</a>
            <a href="#demo" onClick={scrollTo("demo")}>Demo</a>
            <a href="#contact" onClick={scrollTo("contact")}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- inline icons (lucide-style, stroke 2) ---------- */
const s = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const CheckIcon = () => (<svg {...s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
const BellIcon = () => (<svg {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
const SparkIcon = () => (<svg {...s}><path d="M12 3a6 6 0 0 0-6 6c0 2 1 3 1 4h10c0-1 1-2 1-4a6 6 0 0 0-6-6z" /><line x1="9" y1="18" x2="15" y2="18" /></svg>);
const ShieldIcon = () => (<svg {...s} width={18} height={18}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
const DocIcon = () => (<svg {...s}><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="12" y2="16" /></svg>);
const ListIcon = () => (<svg {...s}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>);
const ClockIcon = () => (<svg {...s}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>);
const DoneIcon = () => (<svg {...s}><path d="M20 7L9 18l-5-5" /></svg>);
const ChatIcon = () => (<svg {...s} width={20} height={20}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>);
const BulbIcon = () => (<svg {...s} width={20} height={20}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>);
const ArrowIcon = () => (<svg {...s} width={20} height={20}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>);

const FEATURES: [JSX.Element, string, string][] = [
  [<DocIcon />, "Digitaal intakeformulier", "Een kort, merkeigen formulier dat aanvragen meteen compleet binnenhaalt."],
  [<CheckIcon />, "Automatische klantbevestiging", "De klant krijgt direct een nette bevestiging van de aanvraag."],
  [<BellIcon />, "Interne melding", "Jij krijgt een duidelijke melding zodra er iets binnenkomt."],
  [<ListIcon />, "Leadregistratie in overzicht", "Alle aanvragen op één plek — overzichtelijk en terug te vinden."],
  [<SparkIcon />, "AI-samenvatting per aanvraag", "Een korte, leesbare samenvatting met een concrete vervolgactie."],
  [<ClockIcon />, "Follow-up reminders", "Geautomatiseerde herinneringen zodat geen aanvraag blijft liggen."],
  [<DoneIcon />, "Oplevering met uitleg", "Je krijgt het werkend opgeleverd, met heldere uitleg hoe het werkt."],
  [<ShieldIcon />, "Bug-garantie", "Werkt iets niet zoals afgesproken? Dan los ik het op."],
];

/* ---------- scoped styles ---------- */
const CSS = `
.la-root {
  --la-paper:#FBFAF7; --la-paper-2:#F4F2EC; --la-card:#FFFFFF;
  --la-ink:#1A1916; --la-ink-soft:#3A3833; --la-muted:#76726A; --la-faint:#A8A39A;
  --la-line:#E7E3DA; --la-line-strong:#D8D3C7; --la-accent:#0E5249; --la-accent-soft:#E7EFEC;
  --la-radius:4px; --la-maxw:1180px;
  background:var(--la-paper); color:var(--la-ink);
  font-family:'Hanken Grotesk',sans-serif; font-size:17px; line-height:1.65;
  -webkit-font-smoothing:antialiased;
}
.la-root *{box-sizing:border-box;}
.la-root h1,.la-root h2,.la-root h3{font-family:'Cormorant Garamond',serif;font-weight:500;letter-spacing:-.01em;margin:0;color:var(--la-ink);}
.la-root p{margin:0;}
.la-root a{color:inherit;text-decoration:none;}
.la-root ::selection{background:var(--la-accent);color:#fff;}
.la-wrap{max-width:var(--la-maxw);margin:0 auto;padding:0 40px;}
.la-root .eyebrow{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:var(--la-accent);display:inline-flex;align-items:center;gap:10px;}
.la-root .eyebrow::before{content:"";width:22px;height:1px;background:var(--la-accent);opacity:.5;}
.la-root .eyebrow.center::before{display:none;}
.la-root .btn{font-family:'Hanken Grotesk',sans-serif;font-size:13.5px;font-weight:500;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:transform .25s cubic-bezier(.2,.7,.3,1),background .25s ease,box-shadow .25s ease,color .2s ease;}
.la-root .btn-primary{background:var(--la-ink);color:#fff;padding:12px 22px;border-radius:var(--la-radius);}
.la-root .btn-primary:hover:not(:disabled){background:var(--la-accent);transform:translateY(-1px);box-shadow:0 10px 26px -12px rgba(14,82,73,.55);}
.la-root .btn-ghost{background:transparent;color:var(--la-ink);padding:12px 22px;border-radius:var(--la-radius);border:1px solid var(--la-line-strong);}
.la-root .btn-ghost:hover{border-color:var(--la-ink);transform:translateY(-1px);}
.la-root .arrow{display:inline-block;transition:transform .25s ease;}
.la-root .btn:hover .arrow{transform:translateX(3px);}
.la-hero{padding:140px 0 96px;position:relative;overflow:hidden;}
.la-hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:64px;align-items:end;}
.la-root h1.hero-title{font-size:clamp(46px,6.4vw,88px);line-height:1.02;letter-spacing:-.02em;margin:26px 0 0;}
.la-root .hero-sub{font-size:19px;color:var(--la-ink-soft);line-height:1.6;max-width:30ch;margin:30px 0 34px;}
.la-root .hero-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.la-root .hero-meta{margin-top:30px;padding-top:26px;border-top:1px solid var(--la-line);display:flex;gap:40px;}
.la-root .hero-meta .n{font-family:'Cormorant Garamond',serif;font-size:38px;line-height:1;}
.la-root .hero-meta .l{font-size:12.5px;color:var(--la-muted);margin-top:6px;}
.la-root .note-card{background:var(--la-card);border:1px solid var(--la-line);border-radius:10px;box-shadow:0 30px 60px -34px rgba(26,25,22,.28),0 2px 8px -4px rgba(26,25,22,.1);padding:22px 22px 20px;}
.la-root .note-top{display:flex;align-items:center;gap:11px;margin-bottom:16px;}
.la-root .note-avatar{width:38px;height:38px;border-radius:9px;flex:none;background:var(--la-accent);color:#fff;display:grid;place-items:center;font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:600;}
.la-root .note-app{font-size:12px;color:var(--la-faint);font-family:'JetBrains Mono',monospace;letter-spacing:.04em;}
.la-root .note-name{font-size:14.5px;font-weight:600;}
.la-root .ai-tag{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;color:var(--la-accent);background:var(--la-accent-soft);padding:4px 8px;border-radius:100px;text-transform:uppercase;}
.la-root .note-body{font-size:14.5px;line-height:1.55;color:var(--la-ink-soft);}
.la-root .note-body .row{display:flex;gap:8px;padding:3px 0;}
.la-root .note-body .k{color:var(--la-muted);min-width:96px;}
.la-root .note-body .v{color:var(--la-ink);font-weight:500;}
.la-root .note-foot{margin-top:15px;padding-top:13px;border-top:1px dashed var(--la-line-strong);display:flex;align-items:center;gap:8px;font-size:13px;color:var(--la-accent);font-weight:500;}
.la-root .pulse{width:7px;height:7px;border-radius:50%;background:var(--la-accent);position:relative;}
.la-root .pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--la-accent);opacity:.4;animation:la-ring 2.4s ease-out infinite;}
@keyframes la-ring{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.8);opacity:0}}
.la-root .trust{border-top:1px solid var(--la-line);border-bottom:1px solid var(--la-line);}
.la-root .trust-row{display:flex;align-items:center;justify-content:space-between;padding:22px 0;gap:30px;flex-wrap:wrap;}
.la-root .trust-row .label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--la-faint);}
.la-root .channels{display:flex;align-items:center;gap:26px;flex-wrap:wrap;}
.la-root .channel{font-size:14px;color:var(--la-muted);}
.la-root section.block{padding:116px 0;}
.la-root section.surface{background:var(--la-card);border-top:1px solid var(--la-line);border-bottom:1px solid var(--la-line);}
.la-root .sec-head{max-width:56ch;margin-bottom:64px;}
.la-root h2.sec-title{font-size:clamp(32px,4vw,52px);line-height:1.08;margin:18px 0 0;}
.la-root .sec-head .lead{font-size:18px;color:var(--la-muted);margin-top:18px;line-height:1.6;max-width:48ch;}
.la-root .steps{display:grid;grid-template-columns:repeat(5,1fr);}
.la-root .step{padding:30px 26px 30px 0;border-top:1px solid var(--la-line);position:relative;}
.la-root .step .num{font-family:'Cormorant Garamond',serif;font-size:17px;color:var(--la-accent);font-weight:600;}
.la-root .step h3{font-size:23px;margin:16px 0 9px;line-height:1.15;}
.la-root .step p{font-size:14px;color:var(--la-muted);line-height:1.55;}
.la-root .step .bar{position:absolute;top:-1px;left:0;height:1px;width:0;background:var(--la-ink);transition:width .9s cubic-bezier(.2,.7,.2,1);}
.la-root .step.in .bar{width:64px;}
.la-root .feat-wrap{display:grid;grid-template-columns:.8fr 1.2fr;gap:72px;align-items:start;}
.la-root .feat-list{display:grid;grid-template-columns:1fr 1fr;}
.la-root .feat{padding:24px 22px 24px 0;border-top:1px solid var(--la-line);display:flex;gap:16px;align-items:flex-start;}
.la-root .feat .ic{flex:none;width:34px;height:34px;border-radius:8px;margin-top:1px;border:1px solid var(--la-line-strong);display:grid;place-items:center;color:var(--la-accent);background:var(--la-card);}
.la-root .feat .ft{font-size:15.5px;font-weight:600;}
.la-root .feat .fd{font-size:13.5px;color:var(--la-muted);margin-top:3px;line-height:1.5;}
.la-root .feat-aside{position:sticky;top:110px;}
.la-root .feat-aside .quote{font-family:'Cormorant Garamond',serif;font-size:27px;line-height:1.3;font-style:italic;font-weight:400;margin-top:22px;}
.la-root .guarantee{margin-top:28px;padding:22px;background:var(--la-accent-soft);border-radius:8px;border:1px solid #D6E4DF;}
.la-root .guarantee .gt{font-size:14.5px;font-weight:600;color:var(--la-accent);display:flex;align-items:center;gap:9px;}
.la-root .guarantee .gd{font-size:13.5px;color:var(--la-ink-soft);margin-top:8px;line-height:1.55;}
.la-root .demo{background:var(--la-paper-2);border-top:1px solid var(--la-line);border-bottom:1px solid var(--la-line);}
.la-root .demo-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start;}
.la-root .case-tag{display:inline-flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--la-ink-soft);background:var(--la-card);border:1px solid var(--la-line);padding:7px 13px;border-radius:100px;}
.la-root .case-tag .badge{width:8px;height:8px;border-radius:50%;background:var(--la-accent);}
.la-root .form-card{background:var(--la-card);border:1px solid var(--la-line);border-radius:12px;box-shadow:0 30px 70px -40px rgba(26,25,22,.3);overflow:hidden;}
.la-root .fc-top{padding:16px 22px;border-bottom:1px solid var(--la-line);display:flex;align-items:center;gap:10px;background:linear-gradient(var(--la-card),var(--la-paper));}
.la-root .dots{display:flex;gap:6px;}
.la-root .dots i{width:10px;height:10px;border-radius:50%;display:block;}
.la-root .fc-url{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--la-faint);margin-left:6px;}
.la-root .fc-body{padding:26px 26px 28px;}
.la-root .fc-body h3{font-size:25px;margin-bottom:4px;}
.la-root .fc-sub{font-size:13.5px;color:var(--la-muted);margin-bottom:22px;}
.la-root .field{margin-bottom:15px;}
.la-root .field label{display:block;font-size:12.5px;font-weight:600;color:var(--la-ink-soft);margin-bottom:7px;}
.la-root .field .opt{font-weight:400;color:var(--la-faint);}
.la-root .field input,.la-root .field select,.la-root .field textarea{width:100%;font-family:inherit;font-size:14.5px;color:var(--la-ink);background:var(--la-paper);border:1px solid var(--la-line-strong);border-radius:var(--la-radius);padding:11px 13px;transition:border-color .2s,box-shadow .2s;}
.la-root .field input[type="date"]{color:var(--la-ink);}
.la-root .field input::placeholder,.la-root .field textarea::placeholder{color:var(--la-faint);}
.la-root .field input:focus,.la-root .field select:focus,.la-root .field textarea:focus{outline:none;border-color:var(--la-accent);box-shadow:0 0 0 3px var(--la-accent-soft);}
.la-root .two{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.la-root .chips{display:flex;flex-wrap:wrap;gap:8px;}
.la-root .chip{font-size:13px;padding:8px 13px;border-radius:100px;cursor:pointer;border:1px solid var(--la-line-strong);background:var(--la-paper);color:var(--la-ink-soft);transition:all .18s;font-family:inherit;}
.la-root .chip:hover{border-color:var(--la-accent);color:var(--la-accent);}
.la-root .chip.on{background:var(--la-accent);border-color:var(--la-accent);color:#fff;}
.la-root .fc-submit{width:100%;justify-content:center;margin-top:8px;padding:13px;}
/* Slot picker */
.la-root .slot-section{margin-top:2px;}
.la-root .slot-loading{font-size:13.5px;color:var(--la-muted);padding:10px 0;display:flex;align-items:center;gap:9px;}
.la-root .slot-spinner{width:14px;height:14px;border:2px solid var(--la-line-strong);border-top-color:var(--la-accent);border-radius:50%;animation:la-spin .8s linear infinite;flex:none;}
@keyframes la-spin{to{transform:rotate(360deg)}}
.la-root .slot-empty{font-size:13.5px;color:var(--la-muted);padding:10px 0;font-style:italic;}
.la-root .slot-error{font-size:13.5px;color:#B94040;padding:10px 0;}
.la-root .slots{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;}
.la-root .slot-btn{font-size:13.5px;padding:9px 18px;border-radius:100px;cursor:pointer;border:1px solid var(--la-line-strong);background:var(--la-paper);color:var(--la-ink-soft);transition:all .18s;font-family:inherit;font-weight:500;letter-spacing:.01em;}
.la-root .slot-btn:hover{border-color:var(--la-accent);color:var(--la-accent);background:var(--la-accent-soft);}
.la-root .slot-btn.selected{background:var(--la-accent);border-color:var(--la-accent);color:#fff;box-shadow:0 4px 14px -6px rgba(14,82,73,.5);}
.la-root .slot-hint{font-size:12px;color:var(--la-faint);margin-top:8px;text-align:center;}
.la-root .storage-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--la-line-strong);font-size:12.5px;color:var(--la-muted);line-height:1.5;}
.la-root .storage-icon{flex:none;color:var(--la-accent);margin-top:1px;opacity:.7;}
.la-root .result-stack{display:flex;flex-direction:column;gap:18px;}
.la-root .result-card{background:var(--la-card);border:1px solid var(--la-line);border-radius:12px;padding:20px 22px;opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.3,1);box-shadow:0 18px 44px -34px rgba(26,25,22,.3);}
.la-root .result-card.show{opacity:1;transform:none;}
.la-root .result-card.r1{transition-delay:.05s;}
.la-root .result-card.r2{transition-delay:.35s;}
.la-root .result-card.r3{transition-delay:.65s;}
.la-root .rc-head{display:flex;align-items:center;gap:11px;margin-bottom:13px;}
.la-root .rc-ic{width:34px;height:34px;border-radius:9px;flex:none;display:grid;place-items:center;}
.la-root .rc-ic.green{background:var(--la-accent-soft);color:var(--la-accent);}
.la-root .rc-ic.dark{background:var(--la-ink);color:#fff;}
.la-root .rc-title{font-size:14px;font-weight:600;}
.la-root .rc-meta{font-size:11.5px;color:var(--la-faint);font-family:'JetBrains Mono',monospace;}
.la-root .rc-body{font-size:14px;color:var(--la-ink-soft);line-height:1.6;}
.la-root .ai-summary .row{display:flex;gap:8px;padding:2px 0;font-size:14px;}
.la-root .ai-summary .k{color:var(--la-muted);min-width:112px;}
.la-root .ai-summary .v{color:var(--la-ink);font-weight:500;}
.la-root .ai-action{margin-top:12px;padding-top:11px;border-top:1px dashed var(--la-line-strong);font-size:13.5px;color:var(--la-accent);font-weight:600;display:flex;align-items:center;gap:8px;}
.la-root .demo-placeholder{border:1px dashed var(--la-line-strong);border-radius:12px;padding:40px 28px;text-align:center;color:var(--la-faint);font-size:14px;background:rgba(255,255,255,.4);}
.la-root .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--la-line);border:1px solid var(--la-line);border-radius:10px;overflow:hidden;}
.la-root .stat-cell{background:var(--la-paper);padding:38px 30px;}
.la-root .stat-cell .sn{font-family:'Cormorant Garamond',serif;font-size:56px;line-height:1;letter-spacing:-.01em;}
.la-root .stat-cell .sn .u{font-size:30px;color:var(--la-accent);}
.la-root .stat-cell .sl{font-size:14px;color:var(--la-muted);margin-top:12px;line-height:1.5;}
.la-root .contact{background:var(--la-ink);color:#F4F2EC;}
.la-root .contact .eyebrow{color:#6FD0C2;}
.la-root .contact .eyebrow::before{background:#6FD0C2;}
.la-root .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:start;}
.la-root .contact h2{color:#FBFAF7;}
.la-root .contact .lead{color:#BDB8AE;font-size:18px;margin-top:20px;line-height:1.6;max-width:40ch;}
.la-root .contact-points{margin-top:36px;display:flex;flex-direction:column;gap:18px;}
.la-root .cpoint{display:flex;gap:14px;align-items:flex-start;}
.la-root .cpoint .cic{color:#6FD0C2;margin-top:2px;flex:none;}
.la-root .cpoint .ct{font-size:15px;color:#EDEAE2;font-weight:600;}
.la-root .cpoint .cd{font-size:13.5px;color:#9C978D;margin-top:2px;}
.la-root .contact-card{background:#211F1B;border:1px solid #34322C;border-radius:14px;padding:30px;}
.la-root .contact-card .field label{color:#C9C4B9;}
.la-root .contact-card .field input,.la-root .contact-card .field textarea{background:#1A1916;border-color:#3A3833;color:#F4F2EC;}
.la-root .contact-card .field input::placeholder,.la-root .contact-card .field textarea::placeholder{color:#6E6A61;}
.la-root .contact-card .field input:focus,.la-root .contact-card .field textarea:focus{border-color:#6FD0C2;box-shadow:0 0 0 3px rgba(111,208,194,.14);}
.la-root .contact-card .btn-primary{background:#6FD0C2;color:#11201D;width:100%;justify-content:center;padding:14px;font-weight:600;}
.la-root .contact-card .btn-primary:hover{background:#84DCCF;}
.la-root .form-note{font-size:12px;color:#837F76;margin-top:14px;text-align:center;}
.la-root .thanks{text-align:center;padding:30px 10px;}
.la-root .thanks .tk-ic{width:54px;height:54px;border-radius:50%;background:#6FD0C2;color:#11201D;display:grid;place-items:center;margin:0 auto 18px;}
.la-root .thanks h3{color:#FBFAF7;font-size:30px;}
.la-root .thanks p{color:#9C978D;font-size:15px;margin-top:10px;}
.la-root .final{text-align:center;padding:130px 0;}
.la-root .final h2{font-size:clamp(36px,5.5vw,72px);line-height:1.05;max-width:16ch;margin:22px auto 0;}
.la-root .final p{color:var(--la-muted);font-size:18px;margin:22px auto 36px;max-width:44ch;}
.la-footer{border-top:1px solid var(--la-line);padding:40px 0;}
.la-root .foot-row{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.la-root .foot-row .fl{font-size:13px;color:var(--la-muted);}
.la-root .foot-links{display:flex;gap:26px;}
.la-root .foot-links a{font-size:13px;color:var(--la-muted);transition:color .2s;}
.la-root .foot-links a:hover{color:var(--la-ink);}
.la-root .reveal{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.3,1),transform .8s cubic-bezier(.2,.7,.3,1);}
.la-root .reveal.in{opacity:1;transform:none;}
.la-root .reveal.d1{transition-delay:.08s;}
.la-root .reveal.d2{transition-delay:.16s;}
.la-root .reveal.d3{transition-delay:.24s;}
.la-root .animate-float{animation:la-floaty 5s ease-in-out infinite;}
@keyframes la-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@media (prefers-reduced-motion:reduce){.la-root .reveal{opacity:1;transform:none;transition:none;}.la-root .animate-float{animation:none;}.la-root .pulse::after{animation:none;}}
@media (max-width:980px){
  .la-wrap{padding:0 26px;}
  .la-hero-grid,.la-root .feat-wrap,.la-root .demo-grid,.la-root .contact-grid{grid-template-columns:1fr;gap:44px;}
  .la-root .hero-panel{max-width:440px;}
  .la-root .steps{grid-template-columns:1fr 1fr;}
  .la-root .stats-grid{grid-template-columns:1fr 1fr;}
  .la-root .feat-aside{position:static;}
}
@media (max-width:560px){
  .la-hero{padding:120px 0 72px;}
  .la-root section.block{padding:84px 0;}
  .la-root .feat-list,.la-root .steps,.la-root .stats-grid,.la-root .two{grid-template-columns:1fr;}
  .la-root .hero-meta{gap:26px;}
}
`;
