import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { Watch } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const sessionId = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const res = await api.post("/auth/session", { session_id: sessionId });
        setUser(res.data);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { state: { user: res.data } });
      } catch {
        navigate("/login");
      }
    })();
  }, [location.hash, navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16]">
      <Watch className="w-10 h-10 text-[#D4AF37] rc-spin-slow" />
      <p className="mt-5 text-slate-400 font-mono text-xs tracking-widest uppercase">Authenticating…</p>
    </div>
  );
}
