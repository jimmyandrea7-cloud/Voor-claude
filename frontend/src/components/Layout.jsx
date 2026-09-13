import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export function Disclaimer({ compact }) {
  return (
    <div
      data-testid="legal-disclaimer"
      className={`text-xs leading-relaxed text-[rgba(36,31,26,.6)] border border-[rgba(36,31,26,.2)] ${compact ? "p-3" : "p-4"}`}
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
    <div className="min-h-screen flex flex-col rc-grain bg-[#F3EEE3]">
      <header>
        <div className="flex items-center justify-between gap-6 flex-wrap px-6 md:px-10 h-[52px] font-mono text-[11px] uppercase tracking-[0.1em]">
          <Link to={user ? "/dashboard" : "/"} data-testid="brand-logo" className="flex items-baseline gap-7">
            <span className="text-[#241F1A]">RefCheck</span>
            <span className="hidden sm:inline text-[rgba(36,31,26,.5)] normal-case tracking-normal">Vintage watch identification</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {user && nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                data-testid={`nav-${n.to.replace("/", "")}`}
                className={location.pathname === n.to ? "text-[#241F1A]" : "text-[rgba(36,31,26,.5)] hover:text-[#241F1A]"}
              >
                {n.label}
              </Link>
            ))}
            {user ? (
              <>
                <button data-testid="start-scan-cta" onClick={() => navigate("/scan")} className="text-[#B8420E] hover:text-[#8F3309]">
                  New Identification
                </button>
                <button data-testid="logout-btn" onClick={logout} className="text-[rgba(36,31,26,.5)] hover:text-[#241F1A]">
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" data-testid="header-login" className="text-[#B8420E] hover:text-[#8F3309]">Sign in</Link>
            )}
          </nav>

          <button className="md:hidden text-[#241F1A]" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div className="h-[2px] bg-[#241F1A]" />
        {open && (
          <div className="md:hidden px-6 py-4 space-y-3 border-b border-[rgba(36,31,26,.2)] font-mono text-[11px] uppercase tracking-[0.1em]">
            {user ? (
              <>
                {nav.map((n) => (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block text-[#241F1A]" data-testid={`mnav-${n.to.replace("/", "")}`}>
                    {n.label}
                  </Link>
                ))}
                <button onClick={logout} className="block text-[rgba(36,31,26,.5)]" data-testid="mobile-logout">Log out</button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="block text-[#B8420E]">Sign in</Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <footer className="border-t-[2px] border-[#241F1A] relative z-10">
        <div className="px-6 md:px-10 py-7 space-y-5">
          <Disclaimer compact />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[rgba(36,31,26,.55)]">
            <span>RefCheck — vintage watch identification</span>
            <div className="flex items-center gap-5">
              <Link to="/privacy" className="hover:text-[#241F1A]">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#241F1A]">Terms & Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
