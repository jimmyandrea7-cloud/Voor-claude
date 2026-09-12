import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import Layout, { Disclaimer } from "../components/Layout";
import { toast } from "sonner";
import {
  Loader2, Lock, Check, AlertTriangle, TrendingUp, ShieldCheck, ScrollText,
  Gem, Wrench, Sparkles, ArrowLeft, Unlock,
} from "lucide-react";
import { motion } from "framer-motion";

export default function ScanResult() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [settings, setSettings] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/scans/${scanId}`), api.get("/settings")])
      .then(([s, st]) => { setScan(s.data); setSettings(st.data); })
      .catch(() => { toast.error("Report not found"); navigate("/dashboard"); });
  }, [scanId, navigate]);

  const unlock = async () => {
    setCheckingOut(true);
    try {
      const res = await api.post("/payments/checkout", { scan_id: scanId, origin_url: window.location.origin });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin" /></div></Layout>;

  const r = scan.result || {};
  const conf = r.confidence_percentage ?? 0;
  const lowConf = conf < 40;
  const priceDisplay = settings?.report_price_display || "$9.99";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <button onClick={() => navigate("/dashboard")} className="text-slate-400 hover:text-slate-100 inline-flex items-center gap-1.5 text-sm mb-6"><ArrowLeft className="w-4 h-4" /> My Collection</button>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rc-card rounded-2xl p-7 border-[#D4AF37]/25" data-testid="result-headline">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Preliminary identification</span>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-slate-100 leading-tight" data-testid="result-model-family">{r.likely_model_family || "Undetermined"}</h1>
              <p className="text-slate-400 mt-1">{scan.brand_name || "Omega"} · {r.used_database_match ? "Database-corroborated" : "Visual reasoning only"}</p>
            </div>
            <ConfidenceRing value={conf} />
          </div>

          {r.headline_highlights?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {r.headline_highlights.map((h, i) => (
                <span key={i} className="text-xs bg-[#0F172A] border border-[#1E293B] rounded-full px-3 py-1.5 text-slate-300">{h}</span>
              ))}
            </div>
          )}

          {lowConf && (
            <div className="mt-5 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3.5" data-testid="low-confidence-note">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-200/90 leading-relaxed">
                This identification is uncertain. {r.additional_photo_suggestion || "A clearer photo of the serial number and case back would help most."}
              </p>
            </div>
          )}
        </motion.div>

        {/* Paid vs paywall */}
        {scan.paid ? (
          <FullReport r={r} scan={scan} />
        ) : (
          <Paywall r={r} priceDisplay={priceDisplay} onUnlock={unlock} checkingOut={checkingOut} settings={settings} />
        )}

        <div className="mt-8"><Disclaimer /></div>
      </div>
    </Layout>
  );
}

function ConfidenceRing({ value }) {
  const size = 92, stroke = 8, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
  const color = value >= 70 ? "#D4AF37" : value >= 40 ? "#38BDF8" : "#f59e0b";
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="confidence-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1E293B" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (value / 100) * circ} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-2xl text-slate-100" data-testid="confidence-value">{value}%</span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Match</span>
      </div>
    </div>
  );
}

function Paywall({ r, priceDisplay, onUnlock, checkingOut, settings }) {
  const perks = [
    "Exact reference numbers & caliber match",
    "Estimated production era",
    "Confidence breakdown (what raised & lowered it)",
    "Authenticity signals",
    "Market valuation range",
    "Condition notes & the collector's story",
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="mt-6 rounded-2xl p-8 relative overflow-hidden border border-[#D4AF37]/40"
      style={{ background: "linear-gradient(135deg,#1E293B 0%,#0F172A 55%,#111827 100%)" }}
      data-testid="paywall-card">
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#D4AF37]/10 blur-3xl" />
      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <h2 className="font-serif text-3xl text-slate-100">Unlock the full appraisal</h2>
        <p className="mt-2 text-slate-400 text-sm max-w-md">You've seen the headline match. Unlock the complete horologist report for this watch.</p>

        <ul className="mt-6 grid sm:grid-cols-2 gap-2.5">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-slate-300"><Check className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0" />{p}</li>
          ))}
        </ul>

        <button onClick={onUnlock} disabled={checkingOut} data-testid="unlock-report-button" className="mt-7 w-full sm:w-auto rc-gold-btn px-7 py-3.5 rounded-full font-semibold inline-flex items-center justify-center gap-2">
          {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
          Unlock full report — {priceDisplay}
        </button>
        <p className="mt-3 text-xs text-slate-500">One-time payment for this report. Secure checkout via Stripe.
          {settings?.subscription_enabled && ` Or subscribe: ${settings.subscription_price_display}.`}
        </p>
      </div>
    </motion.div>
  );
}

function Section({ icon: Icon, title, children, testid }) {
  return (
    <div className="rc-card rounded-2xl p-6" data-testid={testid}>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className="w-5 h-5 text-[#D4AF37]" />
        <h3 className="font-serif text-2xl text-slate-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FullReport({ r, scan }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-4" data-testid="full-report">
      <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full px-3 py-1.5">
        <Unlock className="w-3.5 h-3.5" /> Full appraisal unlocked
      </div>

      <Section icon={Gem} title="Reference & era" testid="report-reference">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Meta label="Likely reference numbers" value={(r.likely_reference_numbers || []).join(", ") || "—"} mono />
          <Meta label="Estimated period" value={r.estimated_period || "—"} />
          <Meta label="Database match" value={r.used_database_match ? "Yes — corroborated by reference data" : "No — based on visual reasoning"} />
        </div>
      </Section>

      {r.confidence_breakdown?.length > 0 && (
        <Section icon={TrendingUp} title="Confidence breakdown" testid="report-confidence-breakdown">
          <ul className="space-y-2">
            {r.confidence_breakdown.map((c, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-[#D4AF37] mt-0.5">•</span>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.authenticity_signals?.length > 0 && (
        <Section icon={ShieldCheck} title="Authenticity signals" testid="report-authenticity">
          <p className="text-xs text-slate-500 mb-3">Non-definitive observations — not a certified authentication.</p>
          <ul className="space-y-2">
            {r.authenticity_signals.map((c, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-[#38BDF8] mt-0.5">•</span>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={TrendingUp} title="Market valuation" testid="report-valuation">
        <p className="text-lg text-slate-100 font-medium">{r.estimated_value_range || "—"}</p>
      </Section>

      {r.condition_notes?.length > 0 && (
        <Section icon={Wrench} title="Condition notes" testid="report-condition">
          <ul className="space-y-2">
            {r.condition_notes.map((c, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-slate-500 mt-0.5">•</span>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.story && (
        <Section icon={ScrollText} title="The story" testid="report-story">
          <p className="text-sm text-slate-300 leading-relaxed font-serif text-base">{r.story}</p>
        </Section>
      )}
    </motion.div>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider font-mono mb-1">{label}</div>
      <div className={`text-slate-100 ${mono ? "font-mono text-sm" : ""}`}>{value}</div>
    </div>
  );
}
