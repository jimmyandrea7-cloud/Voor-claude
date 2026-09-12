import { useAuth } from "../context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Watch } from "lucide-react";

export default function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16]">
        <Watch className="w-9 h-9 text-[#D4AF37] rc-spin-slow" />
        <p className="mt-4 text-slate-500 font-mono text-xs tracking-widest uppercase">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}
