import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ink = (a) => `rgba(36,31,26,${a})`;
const specimenNo = (id) => (id ? id.slice(0, 8).toUpperCase() : "");

const ITEMS = [
  "Case reference and calibre number, with the evidence for each",
  "Serial range and production year",
  "Dial variant matched plate by plate against the archive",
  "Everything unresolved, stated plainly — including parts that aren't original",
];

export default function Unlock() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [settings, setSettings] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/scans/${scanId}`), api.get("/settings")])
      .then(([s, st]) => {
        if (s.data.paid) { navigate(`/report/${scanId}`, { replace: true }); return; }
        setScan(s.data); setSettings(st.data);
      })
      .catch(() => { toast.error("Scan not found"); navigate("/dashboard"); });
  }, [scanId, navigate]);

  const pay = async () => {
    setCheckingOut(true);
    try {
      const res = await api.post("/payments/checkout", { scan_id: scanId, origin_url: window.location.origin });
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div></Layout>;

  const price = settings?.report_price_display || "€ 4,99";
  const conf = scan.result?.confidence_percentage ?? 0;
  const summary = scan.result?.preliminary_summary || "";

  return (
    <Layout>
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]" style={{ borderBottom: "2px solid #241F1A" }}>
        <span>RefCheck — specimen {specimenNo(scan.id)}</span>
        <span style={{ color: ink(0.5) }}>Step 03 of 03 · Full report</span>
        <span style={{ color: ink(0.5) }}>{price}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="px-6 md:px-10 py-12" style={{ borderRight: "2px solid #241F1A" }}>
          <h1 className="font-serif font-normal m-0" style={{ fontSize: 42, lineHeight: 1.06, maxWidth: "20ch" }}>One watch, one documented report.</h1>
          <p className="mt-4" style={{ maxWidth: "50ch", fontSize: 16, lineHeight: 1.55, color: ink(0.8) }}>
            No subscription. Pay for this specimen, keep the report. Later specimens are {price} each.
          </p>
          <div className="mt-8" style={{ borderTop: "2px solid #241F1A" }}>
            {ITEMS.map((item, i) => (
              <div key={item} className="grid gap-3.5 py-4" style={{ gridTemplateColumns: "28px minmax(0,1fr)", borderBottom: `1px solid ${ink(0.15)}` }}>
                <span className="font-mono text-[11px] text-[#B8420E]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-[1.5]">{item}</span>
              </div>
            ))}
            <div className="grid gap-3.5 py-4" style={{ gridTemplateColumns: "28px minmax(0,1fr)" }}>
              <span className="font-mono text-[11px] text-[#B8420E]">05</span>
              <span className="text-[15px] leading-[1.5]">A dated document you can send to an insurer, an auction house or a family member</span>
            </div>
          </div>
          <div className="mt-6 font-mono text-[12px] leading-[1.6]" style={{ color: ink(0.6) }}>
            Not a valuation and not an authentication certificate.
          </div>
        </div>

        <div className="px-6 md:px-10 py-12">
          <div style={{ border: "2px solid #241F1A", padding: 30 }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Full report — specimen {specimenNo(scan.id)}</div>
            <div className="flex items-baseline gap-2.5 mt-4">
              <span className="font-serif text-[64px] leading-none">{price}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>one-off</span>
            </div>
            <div style={{ height: 1, background: ink(0.25), margin: "24px 0" }} />
            {summary && (
              <div className="flex justify-between gap-4 font-mono text-[13px]" style={{ color: ink(0.7) }}>
                <span>{summary}</span><span>{conf}%</span>
              </div>
            )}
            <div className="mt-2.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.6) }}>
              Expected confidence once the serial and calibre are read from your frames.
            </div>
            <button onClick={pay} disabled={checkingOut} data-testid="unlock-report-button" className="btn w-full mt-7" style={{ justifyContent: "flex-start" }}>
              {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Pay ${price} and open the report`}
            </button>
            <button onClick={() => navigate(`/report/${scanId}`)} className="btn-outline w-full mt-3" style={{ justifyContent: "flex-start" }}>
              Back to the free result
            </button>
            <div className="mt-4 font-mono text-[11px] leading-[1.6]" style={{ color: ink(0.55) }}>Secure checkout via Stripe · VAT included</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
