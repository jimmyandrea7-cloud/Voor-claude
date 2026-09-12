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
          <div className="absolute inset-0 bg-gradient-to-b from-[#090D16]/70 via-[#090D16]/85 to-[#090D16]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-5 pt-24 pb-20 md:pt-32 md:pb-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300/80 border border-[#D4AF37]/30 rounded-full px-3 py-1">
              <Watch className="w-3.5 h-3.5" /> Vintage watch identification
            </span>
            <h1 className="mt-6 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-slate-100">
              What is that old <span className="rc-gold-text">Omega</span> in your drawer, really?
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              Inherited or found a vintage watch? Upload a few photos and let an expert-grade AI identify the model
              family, likely reference, era and story — with a clear confidence score.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to={cta} data-testid="hero-start-btn" className="rc-gold-btn px-7 py-3.5 rounded-full font-semibold inline-flex items-center gap-2">
                Identify my watch <ArrowRight className="w-4 h-4" />
              </Link>
              {!user && (
                <button onClick={login} data-testid="hero-google-btn" className="px-6 py-3.5 rounded-full border border-[#1E293B] text-slate-300 hover:border-[#D4AF37]/40 hover:text-slate-100 transition-colors">
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
              <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-5">
                <s.icon className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div className="font-mono text-[11px] text-slate-500 mb-1">0{i + 1}</div>
              <h3 className="font-serif text-2xl text-slate-100 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.text}</p>
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
              <f.icon className="w-6 h-6 text-[#38BDF8] mb-3" />
              <h4 className="text-slate-100 font-medium mb-1.5">{f.t}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8"><Disclaimer /></div>
      </section>
    </div>
  );
}
