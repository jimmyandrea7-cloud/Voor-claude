import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Watch, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export function Disclaimer({ compact }) {
  return (
    <div
      data-testid="legal-disclaimer"
      className={`text-xs leading-relaxed text-[#B89A82] border border-[#342115] rounded-lg bg-[#20140D]/60 ${compact ? "p-3" : "p-4"}`}
    >
      <span className="text-amber-300/80 font-mono uppercase tracking-wider text-[10px] block mb-1">Disclaimer</span>
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
    { to: "/scan", label: "Identify a Watch" },
    { to: "/dashboard", label: "My Collection" },
  ];
  if (user?.is_admin) nav.push({ to: "/admin", label: "Reference DB" });

  return (
    <div className="min-h-screen flex flex-col rc-grain relative">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#150E09]/85 border-b border-[#342115]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} data-testid="brand-logo" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full border border-[#E8A87C]/40 flex items-center justify-center group-hover:border-[#E8A87C] transition-colors">
              <Watch className="w-5 h-5 text-[#E8A87C]" />
            </div>
            <span className="font-serif text-xl tracking-wide text-[#FBF1E7]">Ref<span className="rc-gold-text">Check</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {user && nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                data-testid={`nav-${n.to.replace("/", "")}`}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  location.pathname === n.to ? "text-[#E8A87C]" : "text-[#D8BFA8] hover:text-[#FBF1E7]"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {user ? (
              <div className="flex items-center gap-3 ml-3 pl-3 border-l border-[#342115]">
                <button
                  data-testid="start-scan-cta"
                  onClick={() => navigate("/scan")}
                  className="rc-gold-btn px-4 py-2 rounded-full text-sm font-semibold"
                >
                  New Identification
                </button>
                <button data-testid="logout-btn" onClick={logout} className="text-[#D8BFA8] hover:text-[#FBF1E7]" title="Log out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" data-testid="header-login" className="rc-gold-btn px-5 py-2 rounded-full text-sm font-semibold ml-2">
                Sign In
              </Link>
            )}
          </nav>

          <button className="md:hidden text-slate-200" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-[#342115] bg-[#150E09] px-5 py-3 space-y-1">
            {user ? (
              <>
                {nav.map((n) => (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-2 text-slate-300" data-testid={`mnav-${n.to.replace("/", "")}`}>
                    {n.label}
                  </Link>
                ))}
                <button onClick={logout} className="block py-2 text-[#D8BFA8]" data-testid="mobile-logout">Log out</button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="block py-2 text-[#E8A87C]">Sign In</Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 pt-16 relative z-10">{children}</main>

      <footer className="border-t border-[#342115] bg-[#150E09] relative z-10">
        <div className="max-w-6xl mx-auto px-5 py-8 space-y-4">
          <Disclaimer compact />
          <p className="text-xs text-slate-600 text-center">© 2026 RefCheck — AI-assisted horological identification.</p>
        </div>
      </footer>
    </div>
  );
}
