import { useAuth } from "../context/AuthContext";
import { Watch, ArrowRight } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, login, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center rc-grain px-5">
      <div className="rc-card rounded-2xl p-9 w-full max-w-md text-center relative z-10 rc-fade-up">
        <div className="w-14 h-14 mx-auto rounded-full border border-[#D4AF37]/40 flex items-center justify-center mb-6">
          <Watch className="w-7 h-7 text-[#D4AF37]" />
        </div>
        <h1 className="font-serif text-3xl text-slate-100">Welcome to Ref<span className="rc-gold-text">Check</span></h1>
        <p className="mt-3 text-slate-400 text-sm leading-relaxed">
          Sign in to identify your vintage watch and keep your collection of appraisals in one place.
        </p>
        <button
          data-testid="google-login-btn"
          onClick={login}
          className="mt-8 w-full rc-gold-btn py-3.5 rounded-full font-semibold inline-flex items-center justify-center gap-2"
        >
          Continue with Google <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-5 text-xs text-slate-600">Secure Google sign-in. We never see your password.</p>
      </div>
    </div>
  );
}
