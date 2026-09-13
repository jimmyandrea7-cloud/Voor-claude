import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const specimenNo = (id) => (id ? id.slice(0, 8).toUpperCase() : "");

const ITEMS = [
  "Case reference and calibre number, with the evidence for each",
  "Serial range and production year",
  "Dial variant matched plate by plate against the archive",
  "Everything unresolved, stated plainly — including parts that aren't original",
  "A dated PDF you can send to an insurer, an auction house or a family member",
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

  if (!scan) return <div style={{ display: "flex", justifyContent: "center", padding: "96px 0" }}><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const price = settings?.report_price_display || "€ 4,99";
  const conf = scan.result?.confidence_percentage ?? 0;
  const summary = scan.result?.preliminary_summary || "";

  return (
    <>
      <header className="bar" style={{ borderBottom: "var(--rule-strong)" }}>
        <span className="label">RefCheck — specimen {specimenNo(scan.id)}</span>
        <span className="label muted">Step 03 of 03 · Full report</span>
        <span className="label muted">{price}</span>
      </header>

      <section className="cols" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        <div className="divider-r" style={{ padding: "48px 40px" }}>
          <h1 className="h-screen" style={{ fontSize: 42, maxWidth: "20ch" }}>One watch, one documented report.</h1>
          <p className="body" style={{ marginTop: 16, maxWidth: "50ch" }}>No subscription. Pay for this specimen, keep the report. Later specimens are {price} each.</p>

          <div className="rows" style={{ marginTop: 34 }}>
            {ITEMS.map((item, i) => (
              <div key={item} className="row" style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 14, padding: "16px 0" }}>
                <span className="label accent">{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          <p className="mono-note" style={{ marginTop: 26 }}>Not a valuation and not an authentication certificate. If the cross-check can't reach a documented identification, you aren't charged.</p>
        </div>

        <div style={{ padding: "48px 40px" }}>
          <div className="price-box">
            <div className="label label-sm muted">Full report — specimen {specimenNo(scan.id)}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 16 }}>
              <span className="figure-xl">{price}</span>
              <span className="label label-sm muted">one-off</span>
            </div>
            <div style={{ height: 1, background: "rgba(36,31,26,.25)", margin: "24px 0" }} />
            {summary && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, font: "400 13px var(--mono)", color: "var(--ink-66)" }}>
                <span>{summary}</span><span>{conf}%</span>
              </div>
            )}
            <p className="mono-note" style={{ marginTop: 10 }}>Expected confidence once the serial and calibre are read from your frames.</p>
            <button className="btn btn-primary btn-block" onClick={pay} disabled={checkingOut} data-testid="unlock-report-button">
              {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Pay ${price} and open the report`}
            </button>
            <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={() => navigate(`/report/${scanId}`)}>Back to the free result</button>
            <p className="mono-note" style={{ marginTop: 18, fontSize: 11 }}>Secure checkout via Stripe · VAT included</p>
          </div>
          <p className="mono-note" style={{ marginTop: 28 }}>Seiko and smaller makers are not available yet. You'll only ever be asked to pay for a maker we hold verified reference data for.</p>
        </div>
      </section>
    </>
  );
}
