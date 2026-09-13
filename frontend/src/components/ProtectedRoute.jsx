import { useAuth } from "../context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Watch } from "lucide-react";

export default function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F3EEE3]">
        <Watch className="w-8 h-8 text-[#241F1A] rc-spin-slow" />
        <p className="mt-4 text-[#6B5F4F] text-xs tracking-[0.2em] uppercase">Loading</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}
