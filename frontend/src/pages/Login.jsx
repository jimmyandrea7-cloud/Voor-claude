import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";

const ink = (a) => `rgba(36,31,26,${a})`;

export default function Login() {
  const { user, login, loading } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error")) {
      toast.error("Sign-in failed. Please try again.");
    }
  }, [searchParams]);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="rc-grain min-h-screen" style={{ background: "#F3EEE3", color: "#241F1A" }}>
      <div className="px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]">
        <Link to="/" className="text-[#241F1A]">RefCheck</Link>
      </div>
      <div className="h-[2px] bg-[#241F1A]" />

      <div className="grid min-h-[calc(100vh-53px)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="px-6 md:px-10 py-14" style={{ borderRight: "2px solid #241F1A" }}>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ink(0.55) }}>RefCheck — access</div>
          <h1 className="font-serif font-normal mt-5" style={{ fontSize: 44, lineHeight: 1.06, maxWidth: "18ch" }}>
            Your identifications, kept on file.
          </h1>
          <p className="mt-4" style={{ maxWidth: "44ch", fontSize: 16, lineHeight: 1.55, color: ink(0.8) }}>
            Sign in so every specimen you submit keeps its number, its frames and its report.
          </p>
          <div className="mt-9 max-w-[420px]">
            <button data-testid="google-login-btn" onClick={login} className="btn-ink w-full" style={{ justifyContent: "flex-start" }}>
              Continue with Google
            </button>
            <p className="mt-4 font-mono text-[11px]" style={{ color: ink(0.5) }}>Google sign-in. We never see your password.</p>
          </div>
        </div>
        <div
          className="relative min-h-[320px] md:min-h-[520px]"
          style={{
            background: "#9C958A",
            backgroundImage: "repeating-linear-gradient(-45deg, rgba(36,31,26,.06) 0 1px, transparent 1px 14px)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6" style={{ border: "1px dashed rgba(36,31,26,.35)", padding: "26px 34px" }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(36,31,26,.6)" }}>Plate pending</div>
              <div className="mt-1.5 font-serif italic text-[15px]" style={{ color: "rgba(36,31,26,.55)" }}>Workshop bench, cal. 552</div>
            </div>
          </div>
          <div className="absolute left-6 md:left-8 bottom-6 md:right-8 flex justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "#F3EEE3" }}>
            <span style={{ background: "rgba(36,31,26,.8)", padding: "6px 8px" }}>Plate II — bench, cal. 552</span>
            <span style={{ background: "rgba(36,31,26,.8)", padding: "6px 8px" }}>Archive</span>
          </div>
        </div>
      </div>
    </div>
  );
}
