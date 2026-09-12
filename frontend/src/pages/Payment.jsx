import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [scanId, setScanId] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setStatus("error"); return; }
    let timer;
    const poll = async () => {
      attempts.current += 1;
      try {
        const res = await api.get(`/payments/status/${sessionId}`);
        setScanId(res.data.scan_id);
        if (res.data.payment_status === "paid") { setStatus("paid"); return; }
        if (["expired", "failed"].includes(res.data.payment_status)) { setStatus("error"); return; }
      } catch {}
      if (attempts.current >= 10) { setStatus("timeout"); return; }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [params]);

  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        {status === "checking" && (
          <>
            <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto" />
            <h1 className="mt-6 font-serif text-3xl text-slate-100">Confirming your payment…</h1>
            <p className="mt-2 text-slate-400 text-sm">One moment while we unlock your report.</p>
          </>
        )}
        {status === "paid" && (
          <div data-testid="payment-success">
            <CheckCircle2 className="w-14 h-14 text-[#D4AF37] mx-auto" />
            <h1 className="mt-6 font-serif text-3xl text-slate-100">Report unlocked</h1>
            <p className="mt-2 text-slate-400 text-sm">Your full horologist appraisal is ready.</p>
            <button onClick={() => navigate(`/report/${scanId}`)} data-testid="view-report-btn" className="mt-8 rc-gold-btn px-7 py-3.5 rounded-full font-semibold inline-flex items-center gap-2">
              View full report <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {(status === "error" || status === "timeout") && (
          <div data-testid="payment-error">
            <XCircle className="w-14 h-14 text-red-400 mx-auto" />
            <h1 className="mt-6 font-serif text-3xl text-slate-100">{status === "timeout" ? "Still processing" : "Payment issue"}</h1>
            <p className="mt-2 text-slate-400 text-sm">{status === "timeout" ? "This is taking longer than usual. Check your collection shortly." : "We couldn't confirm the payment."}</p>
            <Link to="/dashboard" className="mt-8 inline-block rc-gold-btn px-7 py-3.5 rounded-full font-semibold">Back to My Collection</Link>
          </div>
        )}
      </div>
    </Layout>
  );
}

export function PaymentCancel() {
  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 py-24 text-center" data-testid="payment-cancel">
        <XCircle className="w-14 h-14 text-slate-500 mx-auto" />
        <h1 className="mt-6 font-serif text-3xl text-slate-100">Checkout cancelled</h1>
        <p className="mt-2 text-slate-400 text-sm">No charge was made. Your preliminary result is still saved.</p>
        <Link to="/dashboard" className="mt-8 inline-block rc-gold-btn px-7 py-3.5 rounded-full font-semibold">Back to My Collection</Link>
      </div>
    </Layout>
  );
}
