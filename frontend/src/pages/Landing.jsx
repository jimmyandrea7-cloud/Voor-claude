import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Disclaimer } from "../components/Layout";

const HERO = "https://images.unsplash.com/photo-1641164659090-d264c4c92806?crop=entropy&cs=srgb&fm=jpg&q=90&w=1200";

export default function Landing() {
  const { user, login } = useAuth();
  const cta = user ? "/scan" : "/login";

  const steps = [
    { n: "01", title: "Photograph", text: "Seven guided angles — dial, case back, serial, lugs, crown, movement and bracelet. Each one narrows the field." },
    { n: "02", title: "Cross-check", text: "Serial and reference numbers are matched against documented Omega production ranges from the 1930s onward." },
    { n: "03", title: "Read the report", text: "The likely reference, its production years, a confidence figure — and the reasoning behind every point of it." },
  ];

  const trust = [
    { t: "Cross-checked, not guessed", d: "Every identification is compared against verified Omega references before we commit to an answer — and we say so plainly when the evidence is thin." },
    { t: "Reasoning you can read", d: "The report shows exactly what raised or lowered confidence, from dial typography down to an illegible case-back engraving." },
    { t: "Honest about value", d: "A market range stated as what it is: informational context, never a substitute for a formal appraisal." },
  ];

  return (
    <div className="rc-grain relative overflow-hidden">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 md:pt-32 md:pb-24 relative">
        {/* Faint archival watermark — a real vintage Omega reference, not decoration for its own sake */}
        <div
          aria-hidden="true"
          className="hidden lg:block font-serif absolute select-none pointer-events-none"
          style={{ right: "-40px", top: "-64px", fontSize: 220, color: "rgba(36,31,26,0.035)", fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          N&deg;145.022
        </div>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-16 items-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10">
            <div className="flex items-center gap-3">
              <span className="eyebrow">Vintage Omega identification</span>
              <span className="ref-tag hidden sm:inline">N&deg; 145.022</span>
            </div>
            <h1 className="mt-6 font-serif text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.03] tracking-tight text-[#241F1A]">
              Not a hunch.
              <br />
              <span className="italic" style={{ color: "var(--accent)" }}>A documented identification.</span>
            </h1>
            <p className="mt-7 text-[15px] text-[#6B5F4F] leading-relaxed max-w-md">
              Photograph the watch you inherited and we compare it, detail by detail, against verified Omega
              reference data — serial ranges, calibre numbers and dial variants — then tell you what it is and
              precisely how sure we are.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={cta} data-testid="hero-start-btn" className="btn">
                Begin identification <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {!user && (
                <button onClick={login} data-testid="hero-google-btn" className="btn btn-outline">
                  Continue with Google
                </button>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative">
            {/* mounting frame, offset behind the plate like a matted print */}
            <div className="absolute border border-[#D6CAB0]" style={{ inset: "18px -18px -18px 18px" }} aria-hidden="true" />

            <div
              className="relative overflow-hidden"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 88%, 88% 100%, 0 100%)" }}
            >
              <img src={HERO} alt="A vintage wristwatch resting on a pale surface" className="w-full h-[320px] lg:h-[460px] object-cover" />
              <div className="absolute inset-0 rc-halftone" />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(150deg, rgba(193,68,14,0.38), rgba(36,31,26,0.5))", mixBlendMode: "multiply" }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="ref-tag">Plate 01</span>
              <span className="eyebrow">Subject under examination</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-[#E2D9C6] bg-[#FBF3E2] relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-3 gap-px bg-[#E2D9C6] border border-[#E2D9C6] rounded-[4px] overflow-hidden">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#FBF3E2] p-8"
              >
                <div className="font-serif text-3xl italic" style={{ color: "var(--accent)" }}>{s.n}</div>
                <h3 className="mt-4 font-serif text-2xl text-[#241F1A]">{s.title}</h3>
                <p className="mt-2 text-[13px] text-[#6B5F4F] leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 relative z-10">
        <div className="grid md:grid-cols-3 gap-10 md:gap-12">
          {trust.map((f, i) => (
            <div key={f.t} className="border-t border-[#241F1A] pt-5">
              <span className="ref-tag">{String(i + 1).padStart(2, "0")}</span>
              <h4 className="mt-2 font-serif text-xl text-[#241F1A] mb-2">{f.t}</h4>
              <p className="text-[13px] text-[#6B5F4F] leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 max-w-2xl"><Disclaimer /></div>
      </section>

      <footer className="border-t border-[#E2D9C6] bg-[#F3EEE3] relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-[#9C8F7A] tracking-wide">
          <p>© 2026 RefCheck — Horological identification, documented.</p>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-[#241F1A] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#241F1A] transition-colors">Terms & Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
