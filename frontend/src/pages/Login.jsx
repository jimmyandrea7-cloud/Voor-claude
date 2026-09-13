import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

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
    <>
      <div className="rule" />
      <section className="cols" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        <div className="divider-r" style={{ padding: "56px 40px" }}>
          <div className="label label-kicker muted">RefCheck — access</div>
          <h1 className="h-screen" style={{ marginTop: 22, maxWidth: "18ch" }}>Your identifications, kept on file.</h1>
          <p className="body" style={{ marginTop: 18, maxWidth: "44ch" }}>
            Sign in so every specimen you submit keeps its number, its frames and its report.
          </p>

          <div style={{ marginTop: 36, maxWidth: 420 }}>
            <button className="btn btn-ink btn-block" type="button" onClick={login} data-testid="google-login-btn">Continue with Google</button>
            <p className="mono-note" style={{ marginTop: 14 }}>Google sign-in. We never see your password.</p>
          </div>
        </div>

        <div className="photo" style={{ minHeight: 520, backgroundImage: "repeating-linear-gradient(-45deg, rgba(36,31,26,.06) 0 1px, transparent 1px 14px)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "26px 34px", border: "1px dashed rgba(36,31,26,.35)" }}>
              <div className="label label-sm muted">Plate pending</div>
              <div className="h-card" style={{ marginTop: 6, fontStyle: "italic", fontSize: 15, color: "var(--ink-55)" }}>Workshop bench, cal. 552</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 32, bottom: 26, right: 32, display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span className="label label-sm" style={{ background: "rgba(36,31,26,.8)", color: "var(--parchment)", padding: "6px 8px" }}>Plate II — bench, cal. 552</span>
            <span className="label label-sm" style={{ background: "rgba(36,31,26,.8)", color: "var(--parchment)", padding: "6px 8px" }}>Archive</span>
          </div>
        </div>
      </section>
    </>
  );
}
