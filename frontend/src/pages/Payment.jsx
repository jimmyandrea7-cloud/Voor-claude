import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { Loader2, Check, X, ArrowRight } from "lucide-react";

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
      <div className="max-w-md mx-auto px-6 py-28">
        {status === "checking" && (
          <>
            <Loader2 className="w-8 h-8 text-[#241F1A] animate-spin" />
            <h1 className="mt-7 font-serif text-4xl text-[#241F1A]">Confirming payment</h1>
            <p className="mt-3 text-[14px] text-[#6B5F4F]">A moment while we unlock the report.</p>
          </>
        )}
        {status === "paid" && (
          <div data-testid="payment-success">
            <div className="w-11 h-11 rounded-full border border-[#241F1A] flex items-center justify-center"><Check className="w-5 h-5 text-[#241F1A]" /></div>
            <h1 className="mt-7 font-serif text-4xl text-[#241F1A]">Report unlocked</h1>
            <p className="mt-3 text-[14px] text-[#6B5F4F]">The full identification is ready to read.</p>
            <button onClick={() => navigate(`/report/${scanId}`)} data-testid="view-report-btn" className="btn mt-8">
              Read the report <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {(status === "error" || status === "timeout") && (
          <div data-testid="payment-error">
            <div className="w-11 h-11 rounded-full border border-[#E2D9C6] flex items-center justify-center"><X className="w-5 h-5 text-[#6B5F4F]" /></div>
            <h1 className="mt-7 font-serif text-4xl text-[#241F1A]">{status === "timeout" ? "Still processing" : "Payment issue"}</h1>
            <p className="mt-3 text-[14px] text-[#6B5F4F]">{status === "timeout" ? "This is taking longer than usual. Check your collection shortly." : "We couldn't confirm the payment."}</p>
            <Link to="/dashboard" className="btn mt-8 inline-flex">Back to collection</Link>
          </div>
        )}
      </div>
    </Layout>
  );
}

export function PaymentCancel() {
  return (
    <Layout>
      <div className="max-w-md mx-auto px-6 py-28" data-testid="payment-cancel">
        <div className="w-11 h-11 rounded-full border border-[#E2D9C6] flex items-center justify-center"><X className="w-5 h-5 text-[#6B5F4F]" /></div>
        <h1 className="mt-7 font-serif text-4xl text-[#241F1A]">Checkout cancelled</h1>
        <p className="mt-3 text-[14px] text-[#6B5F4F]">No charge was made. Your preliminary result is still saved.</p>
        <Link to="/dashboard" className="btn mt-8 inline-flex">Back to collection</Link>
      </div>
    </Layout>
  );
}
