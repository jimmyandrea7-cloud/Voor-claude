import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ArrowRight } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center rc-grain px-6 bg-[#F2F1EE]">
      <div className="card rounded-[4px] p-10 w-full max-w-md relative z-10 rc-fade-up">
        <span className="eyebrow">RefCheck</span>
        <h1 className="mt-4 font-serif text-4xl text-[#2A2420] leading-tight">Sign in</h1>
        <p className="mt-4 text-[14px] text-[#6B6259] leading-relaxed">
          Identify a vintage Omega and keep every appraisal — with its photographs and reasoning — in one place.
        </p>
        <button data-testid="google-login-btn" onClick={login} className="btn w-full mt-8">
          Continue with Google <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <p className="mt-5 text-xs text-[#A79E92]">Google sign-in. We never see your password.</p>
      </div>
    </div>
  );
}
