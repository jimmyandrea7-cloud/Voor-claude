import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

function ExamplePanel() {
  const [full, setFull] = useState(false);
  const pct = full ? 96 : 82;
  const filled = Math.round(pct / 5);

  return (
    <div>
      <div className="bar" style={{ borderBottom: "var(--rule-strong)" }}>
        <span className="label label-sm">Cross-check — specimen 4188-A</span>
        <button
          className="label label-sm accent"
          onClick={() => setFull((f) => !f)}
          style={{ background: "none", border: "none", borderBottom: "1px solid var(--rust)", padding: 0, cursor: "pointer" }}
        >
          {full ? "Show preliminary" : "Show full report"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "118px minmax(0,1fr)" }}>
        <div className="photo photo-1x1" style={{ borderRight: "var(--rule-20)", borderBottom: "var(--rule-20)" }} />
        <div style={{ borderBottom: "var(--rule-20)", padding: "18px 32px" }}>
          <div className="label label-sm muted">Dial variant</div>
          <div className="h-card" style={{ marginTop: 7 }}>Linen, applied indices</div>
          <p className="mono-note" style={{ marginTop: 10 }}>Matches 3 of 4 archival plates for Ref. 14700</p>
        </div>
        <div className="photo photo-1x1" style={{ borderRight: "var(--rule-20)", borderBottom: "var(--rule-20)" }} />
        <div style={{ borderBottom: "var(--rule-20)", padding: "18px 32px" }}>
          <div className="label label-sm muted">Calibre</div>
          <div className="h-card" style={{ marginTop: 7 }}>Cal. 552, automatic</div>
          <p className="mono-note" style={{ marginTop: 10 }}>Bridge layout consistent with 1961–1963 production</p>
        </div>
      </div>
      <div style={{ padding: "20px 32px 0" }}>
        <div className="conf-head"><span className="label label-sm muted">Serial range</span><span className="label label-sm muted">24.8M — 25.1M · 1963</span></div>
        <div style={{ height: 1, background: "rgba(36,31,26,.2)", margin: "14px 0" }} />
        <div className="conf-head"><span className="label label-sm muted">Case reference</span><span className="label label-sm muted">14700 SC-61</span></div>
      </div>
      <div style={{ padding: "24px 32px 30px" }}>
        <div className="conf-head">
          <span className="label label-sm muted">Confidence</span>
          <span className="figure-md">{pct}%</span>
        </div>
        <div className="conf-ticks">
          {Array.from({ length: 20 }, (_, i) => <span key={i} className={i < filled ? "on" : ""} />)}
        </div>
        <p className="mono-note" style={{ marginTop: 14 }}>
          {full
            ? "Full report: 11 matched attributes, 1 unresolved (bracelet not original)."
            : "Preliminary: dial and calibre matched. Serial confirmation needs the case back."}
        </p>
        <Link className="btn-link" to="/scan" style={{ display: "inline-block", marginTop: 18 }}>See the example report</Link>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, login } = useAuth();
  const [brands, setBrands] = useState([]);
  const [settings, setSettings] = useState(null);
  const cta = user ? "/scan" : "/login";

  useEffect(() => {
    api.get("/brands").then((r) => setBrands(r.data)).catch(() => {});
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const price = settings?.report_price_display || "€ 4,99";

  const steps = [
    { n: "01", title: "Photograph", text: "Dial, case back, lugs, and the movement if the case opens." },
    { n: "02", title: "Cross-check", text: "Against serial ranges, calibres and dial variants in the archive." },
    { n: "03", title: "Read the report", text: "Every claim shown with its evidence and its margin." },
  ];

  const faqs = [
    { q: "Which makers can you identify?", a: "Omega today. Other makers are being catalogued; until their reference data is verified we say so rather than guess." },
    { q: "What does the free result tell me?", a: "The maker, the likely family, an approximate decade, and how sure we are — with the reasoning shown. Enough to judge whether the full report is worth it to you." },
    { q: "Is this a valuation?", a: "No. RefCheck identifies the watch and documents how it reached that identification. It does not price it, and it is not an authentication certificate." },
    { q: "What if my photographs aren't good enough?", a: "We tell you which frame to retake, and why, before anything is charged." },
    { q: "Do I need to open the case?", a: "No, but a movement photograph raises confidence considerably — the calibre is the strongest single piece of evidence. If you would rather not, leave that frame empty." },
  ];

  return (
    <>
      <header className="bar">
        <div style={{ display: "flex", gap: 28 }}>
          <span className="label">RefCheck</span>
          <span className="label muted">Vintage watch identification</span>
        </div>
        <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <span className="label muted">Reference archive</span>
          <span className="label muted">Method</span>
          {user ? <Link className="label accent" to="/dashboard">Dashboard</Link> : <Link className="label accent" to="/login">Sign in</Link>}
        </nav>
      </header>
      <div className="rule" />

      {/* Hero */}
      <section className="cols">
        <div style={{ padding: "56px 40px 44px" }} className="divider-r">
          <div className="label label-kicker accent" style={{ marginBottom: 28 }}>Fig. 01 — Identification record</div>
          <h1 className="h-hero">Not a hunch. A <em>documented</em> identification.</h1>
          <p className="lead" style={{ marginTop: 26 }}>
            Photograph the watch you inherited and we compare it, detail by detail, against verified Omega
            reference data — serial ranges, calibre numbers and dial variants — then tell you what it is and
            precisely how sure we are.
          </p>
          <div className="btn-row" style={{ marginTop: 34 }}>
            <Link className="btn btn-primary" to={cta}>Begin identification.</Link>
            {!user && <button className="btn btn-outline" onClick={login}>Continue with Google</button>}
          </div>
          <p className="mono-note muted" style={{ marginTop: 30 }}>Free preliminary result. Full report {price}.</p>
        </div>

        <ExamplePanel />
      </section>

      {/* Steps */}
      <div className="rule" />
      <section className="cols cols-3">
        {steps.map((s) => (
          <div key={s.n} className="cell">
            <div className="label accent">{s.n}</div>
            <h3 className="h-step" style={{ marginTop: 8 }}>{s.title}</h3>
            <p className="small" style={{ marginTop: 6 }}>{s.text}</p>
          </div>
        ))}
      </section>

      {/* Reference archive — real brand data (a maker's status here reflects
          what's actually catalogued, not the handoff's placeholder copy) */}
      {brands.length > 0 && (
        <>
          <div className="rule" />
          <section style={{ padding: "52px 40px 0" }}>
            <div className="label label-kicker muted">Fig. 02 — Reference archive</div>
            <h2 className="h-section" style={{ marginTop: 18 }}>What we hold reference data for.</h2>
            <p className="body" style={{ margin: "16px 0 34px", maxWidth: "60ch" }}>
              RefCheck only reports on makers whose references, serial ranges and calibres we have catalogued and
              verified. Everything else is marked out of scope rather than guessed at.
            </p>
          </section>
          <div className="cols cols-4" style={{ borderTop: "var(--rule-25)" }}>
            {brands.map((b) => (
              <div key={b.id} className={`cell${b.active ? "" : " is-unavailable"}`} style={{ padding: "24px 40px", borderBottom: "var(--rule-20)" }}>
                <div className="conf-head">
                  <span className="h-card">{b.name}</span>
                  {b.active
                    ? <span className="tag tag-available">Available</span>
                    : <span className="tag tag-pending">{b.coming_soon_label || "Coming soon"}</span>}
                </div>
                <p className="mono-note" style={{ marginTop: 10 }}>
                  {b.active ? "Serial ranges, calibres, dial variants, case references." : `Not yet available. ${b.notes || "Reference data is being verified."}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Free vs paid */}
      <div className="rule" />
      <section className="cols" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <div style={{ padding: "44px 40px" }} className="divider-r">
          <div className="conf-head">
            <span className="label label-sm muted">Preliminary result</span>
            <span className="figure-xl" style={{ fontSize: 30 }}>Free</span>
          </div>
          <div style={{ borderTop: "var(--rule-25)", marginTop: 20 }}>
            <div className="list-row">Maker and likely family</div>
            <div className="list-row">Approximate decade of production</div>
            <div className="list-row">A confidence figure, and what is limiting it</div>
            <div className="list-row muted">No reference number, calibre or serial dating</div>
          </div>
        </div>
        <div style={{ padding: "44px 40px" }}>
          <div className="conf-head">
            <span className="label label-sm accent">Full report</span>
            <span className="figure-xl" style={{ fontSize: 30 }}>{price}</span>
          </div>
          <div style={{ borderTop: "var(--rule-25)", marginTop: 20 }}>
            <div className="list-row">Case reference and calibre number</div>
            <div className="list-row">Serial range and production year</div>
            <div className="list-row">Dial variant, matched plate by plate</div>
            <div className="list-row">Every matched attribute with its source, and every unresolved one</div>
            <div className="list-row">PDF, dated and citable</div>
          </div>
          <Link className="btn btn-primary" to={cta} style={{ marginTop: 22, display: "inline-block" }}>See what you get.</Link>
        </div>
      </section>

      {/* FAQ */}
      <div className="rule" />
      <section style={{ padding: "52px 40px 8px" }}>
        <div className="label label-kicker muted">Fig. 03 — Questions</div>
      </section>
      <section style={{ padding: "0 40px 48px" }}>
        {faqs.map((f) => (
          <div key={f.q} className="faq-item">
            <h3 className="h-faq">{f.q}</h3>
            <p className="body" style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}
      </section>

      {/* Closing band */}
      <section className="band">
        <h2 className="h-poster">Not a hunch. A documented identification.</h2>
        <div className="btn-row" style={{ marginTop: 34 }}>
          <Link className="btn btn-primary" to={cta}>Begin identification.</Link>
          {!user && <button className="btn btn-outline" onClick={login}>Continue with Google</button>}
        </div>
      </section>
      <footer className="bar" style={{ padding: "20px 40px" }}>
        <span className="label label-sm muted">RefCheck — vintage watch identification</span>
        <span className="label label-sm muted">
          <Link to="/privacy" style={{ color: "inherit" }}>Privacy</Link> · <Link to="/terms" style={{ color: "inherit" }}>Terms</Link>
        </span>
      </footer>
    </>
  );
}
