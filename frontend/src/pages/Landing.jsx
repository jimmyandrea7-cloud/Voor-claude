import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const ink = (a) => `rgba(36,31,26,${a})`;

function Rule({ weight = 1, className = "" }) {
  return <div className={className} style={{ height: weight, background: weight >= 2 ? "#241F1A" : ink(0.2) }} />;
}

function CrossCheckPanel() {
  const [full, setFull] = useState(false);
  const pct = full ? 96 : 82;
  const filled = Math.round(pct / 5);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 px-8 py-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid #241F1A" }}>
        <span>Cross-check — specimen 4188-A</span>
        <button onClick={() => setFull((f) => !f)} className="text-[#B8420E] hover:text-[#8F3309]" style={{ borderBottom: "1px solid #B8420E" }}>
          {full ? "Show preliminary" : "Show full report"}
        </button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "118px minmax(0,1fr)" }}>
        <div style={{ borderRight: `1px solid ${ink(0.2)}`, borderBottom: `1px solid ${ink(0.2)}`, minHeight: 150, background: "#9C958A" }} />
        <div className="px-8 py-4" style={{ borderBottom: `1px solid ${ink(0.2)}` }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.5) }}>Dial variant</div>
          <div className="font-serif text-[26px] leading-[1.2] mt-1.5">Linen, applied indices</div>
          <div className="mt-2.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.62) }}>Matches 3 of 4 archival plates for Ref. 14700</div>
        </div>
        <div style={{ borderRight: `1px solid ${ink(0.2)}`, borderBottom: `1px solid ${ink(0.2)}`, minHeight: 150, background: "#9C958A" }} />
        <div className="px-8 py-4" style={{ borderBottom: `1px solid ${ink(0.2)}` }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.5) }}>Calibre</div>
          <div className="font-serif text-[26px] leading-[1.2] mt-1.5">Cal. 552, automatic</div>
          <div className="mt-2.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.62) }}>Bridge layout consistent with 1961–1963 production</div>
        </div>
      </div>
      <div className="px-8 pt-5">
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>
          <span>Serial range</span><span>24.8M — 25.1M · 1963</span>
        </div>
        <Rule className="my-3.5" />
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>
          <span>Case reference</span><span>14700 SC-61</span>
        </div>
      </div>
      <div className="px-8 pt-6 pb-7">
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Confidence</div>
          <div className="font-serif text-[34px] leading-none text-[#B8420E]">{pct}%</div>
        </div>
        <div className="flex gap-[3px] mt-3">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 14, background: i < filled ? "#B8420E" : ink(0.14) }} />
          ))}
        </div>
        <div className="mt-3.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.62) }}>
          {full
            ? "Full report: 11 matched attributes, 1 unresolved (bracelet not original)."
            : "Preliminary: dial and calibre matched. Serial confirmation needs the case back."}
        </div>
        <Link to="/scan" className="inline-block mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#241F1A] hover:text-[#B8420E]" style={{ borderBottom: "1px solid #241F1A" }}>
          See the example report
        </Link>
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
    <div className="rc-grain" style={{ background: "#F3EEE3", color: "#241F1A" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-6 flex-wrap px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]">
        <div className="flex gap-7">
          <span>RefCheck</span>
          <span className="hidden sm:inline normal-case tracking-normal" style={{ color: ink(0.5) }}>Vintage watch identification</span>
        </div>
        <div className="flex gap-7 items-center">
          <span className="hidden sm:inline" style={{ color: ink(0.5) }}>Reference archive</span>
          <span className="hidden sm:inline" style={{ color: ink(0.5) }}>Method</span>
          {user ? (
            <Link to="/dashboard" className="text-[#B8420E] hover:text-[#8F3309]">Dashboard</Link>
          ) : (
            <Link to="/login" data-testid="header-login" className="text-[#B8420E] hover:text-[#8F3309]">Sign in</Link>
          )}
        </div>
      </div>
      <Rule weight={2} />

      {/* Hero */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <div className="px-6 md:px-10 pt-14 pb-11" style={{ borderRight: "2px solid #241F1A" }}>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#B8420E] mb-7">Fig. 01 — Identification record</div>
          <h1 className="font-serif font-normal m-0" style={{ fontSize: 58, lineHeight: 1.03, letterSpacing: "-0.015em", maxWidth: "15ch" }}>
            Not a hunch. A <em className="italic">documented</em> identification.
          </h1>
          <p className="mt-6" style={{ maxWidth: "46ch", fontSize: 17, lineHeight: 1.55, color: ink(0.82) }}>
            Photograph the watch you inherited and we compare it, detail by detail, against verified Omega
            reference data — serial ranges, calibre numbers and dial variants — then tell you what it is and
            precisely how sure we are.
          </p>
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link to={cta} data-testid="hero-start-btn" className="btn" style={{ minWidth: 230 }}>Begin identification.</Link>
            {!user && (
              <button onClick={login} data-testid="hero-google-btn" className="btn-outline">Continue with Google</button>
            )}
          </div>
          <div className="mt-7 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.5) }}>
            Free preliminary result. Full report {price}.
          </div>
        </div>

        <CrossCheckPanel />
      </div>

      <Rule weight={2} />

      {/* Steps */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {steps.map((s, i) => (
          <div key={s.n} className="px-6 md:px-10 py-7" style={{ borderRight: i < steps.length - 1 ? `1px solid ${ink(0.2)}` : "none" }}>
            <div className="font-mono text-[11px] text-[#B8420E]">{s.n}</div>
            <div className="font-serif text-[22px] mt-2">{s.title}</div>
            <div className="text-[13px] leading-[1.5] mt-1.5" style={{ color: ink(0.66) }}>{s.text}</div>
          </div>
        ))}
      </div>

      {/* Reference archive — live from the real brand list */}
      {brands.length > 0 && (
        <>
          <Rule weight={2} />
          <div className="px-6 md:px-10 pt-13">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ink(0.55) }}>Fig. 02 — Reference archive</div>
            <h2 className="font-serif font-normal mt-4" style={{ fontSize: 38, lineHeight: 1.1, maxWidth: "24ch" }}>What we hold reference data for.</h2>
            <p className="mt-4 mb-8" style={{ maxWidth: "60ch", fontSize: 16, lineHeight: 1.55, color: ink(0.78) }}>
              RefCheck only reports on makers whose references, serial ranges and calibres we have catalogued and
              verified. Everything else is marked out of scope rather than guessed at.
            </p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", borderTop: `1px solid ${ink(0.25)}` }}>
            {brands.map((b, i) => (
              <div key={b.id} className="px-6 md:px-10 py-6" style={{ borderRight: `1px solid ${ink(0.2)}`, borderBottom: `1px solid ${ink(0.2)}`, opacity: b.active ? 1 : 0.55 }}>
                <div className="flex justify-between items-baseline gap-3">
                  <div className="font-serif text-[26px]">{b.name}</div>
                  {b.active ? (
                    <span className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: 9, background: "#B8420E", color: "#F3EEE3", padding: "5px 7px" }}>Available</span>
                  ) : (
                    <span className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: 9, border: "1px solid #241F1A", padding: "4px 6px" }}>{b.coming_soon_label || "Coming soon"}</span>
                  )}
                </div>
                <div className="mt-2.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.62) }}>
                  {b.active ? "Serial ranges, calibres, dial variants, case references." : `Not yet available. ${b.notes || "Reference data is being verified."}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Rule weight={2} />

      {/* Free vs paid */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="px-6 md:px-10 py-11" style={{ borderRight: "2px solid #241F1A" }}>
          <div className="flex justify-between items-baseline gap-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Preliminary result</div>
            <div className="font-serif text-[30px]">Free</div>
          </div>
          <Rule className="mt-5" />
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Maker and likely family</div>
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Approximate decade of production</div>
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>A confidence figure, and what is limiting it</div>
          <div className="py-3.5 text-[15px]" style={{ color: ink(0.5) }}>No reference number, calibre or serial dating</div>
        </div>
        <div className="px-6 md:px-10 py-11">
          <div className="flex justify-between items-baseline gap-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#B8420E]">Full report</div>
            <div className="font-serif text-[30px]">{price}</div>
          </div>
          <Rule className="mt-5" />
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Case reference and calibre number</div>
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Serial range and production year</div>
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Dial variant, matched plate by plate</div>
          <div className="py-3.5 text-[15px]" style={{ borderBottom: `1px solid ${ink(0.15)}` }}>Every matched attribute with its source, and every unresolved one</div>
          <div className="py-3.5 text-[15px]">PDF, dated and citable</div>
          <Link to={cta} className="btn mt-5" style={{ minWidth: 230 }}>See what you get.</Link>
        </div>
      </div>

      <Rule weight={2} />

      {/* FAQ */}
      <div className="px-6 md:px-10 pt-13 pb-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ink(0.55) }}>Fig. 03 — Questions</div>
      </div>
      <div className="px-6 md:px-10 pb-12">
        {faqs.map((f, i) => (
          <div key={f.q} className="grid gap-10 py-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", borderTop: `1px solid ${ink(0.25)}`, borderBottom: i === faqs.length - 1 ? `1px solid ${ink(0.25)}` : "none" }}>
            <h3 className="font-serif font-normal m-0" style={{ fontSize: 24, lineHeight: 1.2 }}>{f.q}</h3>
            <p className="m-0 text-[15px] leading-[1.6]" style={{ color: ink(0.8) }}>{f.a}</p>
          </div>
        ))}
      </div>

      {/* Closing band */}
      <div className="px-6 md:px-10 py-14" style={{ background: "#B8420E", color: "#F3EEE3" }}>
        <h2 className="font-serif font-light m-0" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-0.02em", maxWidth: "22ch" }}>
          Not a hunch. A documented identification.
        </h2>
        <div className="flex gap-3 mt-8 flex-wrap">
          <Link to={cta} className="font-medium" style={{ minWidth: 230, background: "#F3EEE3", color: "#241F1A", padding: "16px 22px", display: "inline-flex", alignItems: "center" }}>
            Begin identification.
          </Link>
          {!user && (
            <button onClick={login} className="font-medium" style={{ background: "transparent", color: "#F3EEE3", border: "2px solid #F3EEE3", padding: "14px 22px", display: "inline-flex", alignItems: "center" }}>
              Continue with Google
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between gap-6 flex-wrap px-6 md:px-10 py-5 font-mono text-[10px] leading-[1.6] uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>
        <span>RefCheck — vintage watch identification</span>
        <div className="flex gap-5">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </div>
    </div>
  );
}
