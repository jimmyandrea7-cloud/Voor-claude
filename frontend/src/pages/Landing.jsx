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
    <div className="rc-grain relative">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="eyebrow">Vintage Omega identification</span>
            <h1 className="mt-6 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight text-[#2A2420]">
              Not a hunch.
              <br />
              <span className="italic text-[#6B6259]">A documented identification.</span>
            </h1>
            <p className="mt-7 text-[15px] text-[#6B6259] leading-relaxed max-w-md">
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
            <div className="card rounded-[4px] p-2.5">
              <img src={HERO} alt="A vintage wristwatch resting on a pale surface" className="w-full h-[300px] lg:h-[440px] object-cover rounded-[2px]" />
            </div>
            <p className="eyebrow mt-3 text-right">Plate 01 — subject under examination</p>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-[#E4E1DA] bg-[#FAFAF8] relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-3 gap-px bg-[#E4E1DA] border border-[#E4E1DA] rounded-[4px] overflow-hidden">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-[#FAFAF8] p-8"
              >
                <div className="font-serif text-3xl text-[#C7C2B7]">{s.n}</div>
                <h3 className="mt-4 font-serif text-2xl text-[#2A2420]">{s.title}</h3>
                <p className="mt-2 text-[13px] text-[#6B6259] leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 relative z-10">
        <div className="grid md:grid-cols-3 gap-10 md:gap-12">
          {trust.map((f) => (
            <div key={f.t} className="border-t border-[#2A2420] pt-5">
              <h4 className="font-serif text-xl text-[#2A2420] mb-2">{f.t}</h4>
              <p className="text-[13px] text-[#6B6259] leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 max-w-2xl"><Disclaimer /></div>
      </section>
    </div>
  );
}
