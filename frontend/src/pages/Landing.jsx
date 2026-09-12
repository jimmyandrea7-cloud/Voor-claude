import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Watch, ScanSearch, Database, ShieldCheck, ArrowRight, Camera, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Disclaimer } from "../components/Layout";

const HERO = "https://images.unsplash.com/photo-1556453007-ee036169934b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Landing() {
  const { user, login } = useAuth();
  const cta = user ? "/scan" : "/login";

  const steps = [
    { icon: Camera, title: "Photograph", text: "Snap the dial, case back, serial, crown and bracelet — guided step by step." },
    { icon: ScanSearch, title: "Analyze", text: "Our vision AI reads hallmarks and cross-references a curated reference database." },
    { icon: Sparkles, title: "Discover", text: "Get a model-family match with a confidence score, then unlock the full appraisal." },
  ];

  return (
    <div className="rc-grain relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO} alt="" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#150E09]/70 via-[#150E09]/85 to-[#150E09]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-5 pt-24 pb-20 md:pt-32 md:pb-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-[#E8A87C]/80 border border-[#E8A87C]/30 rounded-full px-3 py-1">
              <Watch className="w-3.5 h-3.5" /> Inherited watch identification
            </span>
            <h1 className="mt-6 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-[#FBF1E7]">
              What story is hiding in your <span className="rc-gold-text">grandfather's</span> watch?
            </h1>
            <p className="mt-6 text-base sm:text-lg text-[#D8BFA8] leading-relaxed max-w-xl">
              Inherited or found a vintage watch? Snap a few photos and let's find out together — the model
              family, likely reference, era and the story behind it, with a clear confidence score.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to={cta} data-testid="hero-start-btn" className="rc-gold-btn px-7 py-3.5 rounded-full font-semibold inline-flex items-center gap-2">
                Tell me its story <ArrowRight className="w-4 h-4" />
              </Link>
              {!user && (
                <button onClick={login} data-testid="hero-google-btn" className="px-6 py-3.5 rounded-full border border-[#342115] text-[#D8BFA8] hover:border-[#E8A87C]/40 hover:text-[#FBF1E7] transition-colors">
                  Continue with Google
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24 relative z-10">
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="rc-card rounded-2xl p-7"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E8A87C]/10 border border-[#E8A87C]/30 flex items-center justify-center mb-5">
                <s.icon className="w-5 h-5 text-[#E8A87C]" />
              </div>
              <div className="font-mono text-[11px] text-[#B89A82] mb-1">0{i + 1}</div>
              <h3 className="font-serif text-2xl text-[#FBF1E7] mb-2">{s.title}</h3>
              <p className="text-sm text-[#D8BFA8] leading-relaxed">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="max-w-6xl mx-auto px-5 pb-20 relative z-10">
        <div className="rc-card rounded-2xl p-8 md:p-12 grid md:grid-cols-3 gap-8">
          {[
            { icon: Database, t: "Curated reference database", d: "Serial ranges, references, calibers and dial variants for well-known Omega families — always growing." },
            { icon: ShieldCheck, t: "Honest confidence scoring", d: "Every result shows what raised or lowered confidence, and tells you when it simply isn't sure." },
            { icon: Sparkles, t: "The full story", d: "Unlock era, value range, authenticity signals and the historical context behind your watch." },
          ].map((f) => (
            <div key={f.t} className="flex flex-col">
              <f.icon className="w-6 h-6 text-[#E8A87C] mb-3" />
              <h4 className="text-[#FBF1E7] font-medium mb-1.5">{f.t}</h4>
              <p className="text-sm text-[#D8BFA8] leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8"><Disclaimer /></div>
      </section>
    </div>
  );
}
