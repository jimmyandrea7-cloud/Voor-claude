import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export function Disclaimer({ compact }) {
  return (
    <div
      data-testid="legal-disclaimer"
      className={`text-xs leading-relaxed text-[#6B5F4F] border border-[#E2D9C6] rounded-[3px] bg-[#FBF3E2] ${compact ? "p-3" : "p-4"}`}
    >
      <span className="eyebrow block mb-1.5">Disclaimer</span>
      This is an AI-assisted estimate for informational purposes only — not a certified appraisal or authentication.
      Consult a professional (e.g. an Omega authorized dealer or certified watchmaker) before buying, selling, or
      insuring based on this report.
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const nav = [
    { to: "/scan", label: "Identify" },
    { to: "/dashboard", label: "Collection" },
  ];
  if (user?.is_admin) nav.push({ to: "/admin", label: "Reference" });

  return (
    <div className="min-h-screen flex flex-col rc-grain relative bg-[#F3EEE3]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F3EEE3]/90 backdrop-blur-md border-b border-[#E2D9C6]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} data-testid="brand-logo" className="flex items-baseline gap-2 group">
            <span className="font-serif text-2xl tracking-tight text-[#241F1A]">RefCheck</span>
            <span className="eyebrow hidden sm:inline">Omega</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {user && nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                data-testid={`nav-${n.to.replace("/", "")}`}
                className={`text-xs uppercase tracking-[0.14em] transition-colors ${
                  location.pathname === n.to ? "text-[#241F1A]" : "text-[#6B5F4F] hover:text-[#241F1A]"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {user ? (
              <div className="flex items-center gap-5 pl-6 border-l border-[#E2D9C6]">
                <button data-testid="start-scan-cta" onClick={() => navigate("/scan")} className="btn btn-sm">
                  New Identification
                </button>
                <button data-testid="logout-btn" onClick={logout} className="text-[#6B5F4F] hover:text-[#241F1A] transition-colors" title="Log out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" data-testid="header-login" className="btn btn-sm">Sign In</Link>
            )}
          </nav>

          <button className="md:hidden text-[#241F1A]" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-[#E2D9C6] bg-[#F3EEE3] px-6 py-4 space-y-3">
            {user ? (
              <>
                {nav.map((n) => (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block text-sm text-[#241F1A] uppercase tracking-[0.14em]" data-testid={`mnav-${n.to.replace("/", "")}`}>
                    {n.label}
                  </Link>
                ))}
                <button onClick={logout} className="block text-sm text-[#6B5F4F] uppercase tracking-[0.14em]" data-testid="mobile-logout">Log out</button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="block text-sm text-[#241F1A] uppercase tracking-[0.14em]">Sign In</Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 pt-16 relative z-10">{children}</main>

      <footer className="border-t border-[#E2D9C6] bg-[#F3EEE3] relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-5">
          <Disclaimer compact />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-[#9C8F7A] tracking-wide">
            <p>© 2026 RefCheck — Horological identification, documented.</p>
            <span className="hidden sm:inline">·</span>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="hover:text-[#241F1A] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#241F1A] transition-colors">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
