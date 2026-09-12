import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout, { Disclaimer } from "../components/Layout";
import { toast } from "sonner";
import { Loader2, Check, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
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

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-[#2A2420] animate-spin" /></div></Layout>;

  const r = scan.result || {};
  const conf = r.confidence_percentage ?? 0;
  const lowConf = conf < 40;
  const priceDisplay = settings?.report_price_display || "$9.99";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button onClick={() => navigate("/dashboard")} className="text-[#6B6259] hover:text-[#2A2420] inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] mb-8"><ArrowLeft className="w-3.5 h-3.5" /> Collection</button>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} data-testid="result-headline">
          <span className="eyebrow">Preliminary identification</span>
          <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-4xl sm:text-5xl text-[#2A2420] leading-[1.05]" data-testid="result-model-family">{r.likely_model_family || "Undetermined"}</h1>
              <p className="text-[13px] text-[#6B6259] mt-3">
                {scan.brand_name || "Omega"} · {r.used_database_match ? "Corroborated by reference data" : "Visual reasoning only"}
              </p>
            </div>
            <ConfidenceRing value={conf} />
          </div>

          {r.headline_highlights?.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {r.headline_highlights.map((h, i) => (
                <span key={i} className="text-[12px] border border-[#E4E1DA] rounded-[3px] px-3 py-1.5 text-[#6B6259] bg-white">{h}</span>
              ))}
            </div>
          )}

          {lowConf && (
            <div className="mt-6 flex items-start gap-2.5 border border-[#E4E1DA] bg-[#FAFAF8] rounded-[3px] p-4" data-testid="low-confidence-note">
              <AlertTriangle className="w-4 h-4 text-[#6B6259] mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#6B6259] leading-relaxed">
                The evidence is thin, so this remains uncertain. {r.additional_photo_suggestion || "A sharper photograph of the serial number and case back would help most."}
              </p>
            </div>
          )}
        </motion.div>

        <div className="my-9 h-px bg-[#E4E1DA]" />

        {scan.paid ? (
          <FullReport r={r} />
        ) : (
          <Paywall priceDisplay={priceDisplay} onUnlock={unlock} checkingOut={checkingOut} settings={settings} />
        )}

        <div className="mt-10"><Disclaimer /></div>
      </div>
    </Layout>
  );
}

function ConfidenceRing({ value }) {
  const size = 96, stroke = 6, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-testid="confidence-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E4E1DA" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#2A2420" strokeWidth={stroke} fill="none" strokeLinecap="butt" strokeDasharray={circ} strokeDashoffset={circ - (value / 100) * circ} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl text-[#2A2420]" data-testid="confidence-value">{value}</span>
        <span className="eyebrow" style={{ fontSize: 9 }}>Confidence</span>
      </div>
    </div>
  );
}

function Paywall({ priceDisplay, onUnlock, checkingOut, settings }) {
  const perks = [
    "Reference numbers, ranked, with the matching calibre",
    "Estimated production years",
    "Confidence breakdown — what raised and lowered it",
    "Authenticity signals, stated as signals",
    "Market valuation range",
    "Condition notes and the model's history",
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card rounded-[4px] p-8" data-testid="paywall-card">
      <span className="eyebrow">The full identification</span>
      <h2 className="mt-3 font-serif text-3xl text-[#2A2420]">Read the complete report</h2>
      <p className="mt-3 text-[14px] text-[#6B6259] max-w-md">
        You have the headline match. The full report sets out the reference, the era, and the reasoning behind every point — everything you would want before you insure, sell, or simply understand it.
      </p>

      <ul className="mt-7 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[13px] text-[#2A2420]"><Check className="w-4 h-4 text-[#6B6259] mt-0.5 shrink-0" />{p}</li>
        ))}
      </ul>

      <div className="mt-8 flex items-center gap-5 flex-wrap">
        <button onClick={onUnlock} disabled={checkingOut} data-testid="unlock-report-button" className="btn">
          {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Unlock the report — {priceDisplay}
        </button>
        <p className="text-xs text-[#A79E92] max-w-[16rem]">One-time payment for this report. Secure checkout via Stripe.
          {settings?.subscription_enabled && ` Or subscribe: ${settings.subscription_price_display}.`}
        </p>
      </div>
    </motion.div>
  );
}

function ReportSection({ title, children, testid }) {
  return (
    <div className="pt-7 border-t border-[#E4E1DA]" data-testid={testid}>
      <span className="eyebrow">{title}</span>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FullReport({ r }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-7" data-testid="full-report">
      <span className="inline-flex items-center gap-1.5 eyebrow"><Check className="w-3.5 h-3.5" /> Full report</span>

      <ReportSection title="Reference & era" testid="report-reference">
        <div className="grid sm:grid-cols-2 gap-5 text-[14px]">
          <Meta label="Likely references" value={(r.likely_reference_numbers || []).join(",  ") || "—"} />
          <Meta label="Estimated period" value={r.estimated_period || "—"} />
          <Meta label="Reference-data match" value={r.used_database_match ? "Corroborated by documented references" : "Not matched — visual reasoning"} />
        </div>
      </ReportSection>

      {r.confidence_breakdown?.length > 0 && (
        <ReportSection title="Confidence breakdown" testid="report-confidence-breakdown">
          <ul className="space-y-2.5">
            {r.confidence_breakdown.map((c, i) => (
              <li key={i} className="text-[14px] text-[#2A2420] flex items-start gap-3"><span className="text-[#C7C2B7] mt-0.5">—</span>{c}</li>
            ))}
          </ul>
        </ReportSection>
      )}

      {r.authenticity_signals?.length > 0 && (
        <ReportSection title="Authenticity signals" testid="report-authenticity">
          <p className="text-[12px] text-[#A79E92] mb-3">Signals only — not a certified authentication.</p>
          <ul className="space-y-2.5">
            {r.authenticity_signals.map((c, i) => (
              <li key={i} className="text-[14px] text-[#2A2420] flex items-start gap-3"><span className="text-[#C7C2B7] mt-0.5">—</span>{c}</li>
            ))}
          </ul>
        </ReportSection>
      )}

      <ReportSection title="Market valuation" testid="report-valuation">
        <p className="font-serif text-2xl text-[#2A2420]">{r.estimated_value_range || "—"}</p>
      </ReportSection>

      {r.condition_notes?.length > 0 && (
        <ReportSection title="Condition" testid="report-condition">
          <ul className="space-y-2.5">
            {r.condition_notes.map((c, i) => (
              <li key={i} className="text-[14px] text-[#2A2420] flex items-start gap-3"><span className="text-[#C7C2B7] mt-0.5">—</span>{c}</li>
            ))}
          </ul>
        </ReportSection>
      )}

      {r.story && (
        <ReportSection title="History" testid="report-story">
          <p className="font-serif text-[19px] text-[#2A2420] leading-relaxed italic">{r.story}</p>
        </ReportSection>
      )}
    </motion.div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="text-[#2A2420]">{value}</div>
    </div>
  );
}
