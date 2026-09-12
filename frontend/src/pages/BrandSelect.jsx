import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { Watch, Check, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function BrandSelect() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/brands").then((r) => setBrands(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startScan = async (brand) => {
    if (!brand.active) return;
    setCreating(true);
    try {
      const res = await api.post("/scans", { brand_id: brand.id });
      navigate(`/scan/${res.data.id}`);
    } catch (e) {
      toast.error("Could not start identification. Please try again.");
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-10 rc-fade-up">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Step 1 of 4</span>
          <h1 className="mt-3 font-serif text-4xl text-slate-100">Choose the maison</h1>
          <p className="mt-2 text-slate-400 max-w-xl">Select the brand of your watch. Omega is fully supported today — more houses are on the way.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Watch className="w-8 h-8 text-[#D4AF37] rc-spin-slow" /></div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {brands.map((b) => (
              <button
                key={b.id}
                data-testid={`brand-card-${b.name.toLowerCase().replace(/\s+/g, "-")}`}
                disabled={!b.active || creating}
                onClick={() => startScan(b)}
                className={`text-left rc-card rounded-2xl p-6 relative transition-all group ${
                  b.active
                    ? "hover:border-[#D4AF37]/50 hover:shadow-[0_0_25px_rgba(212,175,55,0.12)] cursor-pointer"
                    : "opacity-70 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-2xl text-slate-100 tracking-wide">{b.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{b.tagline}</p>
                  </div>
                  {b.active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full px-2.5 py-1">
                      <Check className="w-3 h-3" /> Supported
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider bg-slate-800/80 text-slate-400 border border-slate-700 rounded-full px-2.5 py-1">
                      <Clock className="w-3 h-3" /> {b.coming_soon_label || "Soon"}
                    </span>
                  )}
                </div>
                {b.active && (
                  <div className="mt-6 inline-flex items-center gap-2 text-sm text-[#D4AF37] group-hover:gap-3 transition-all">
                    Begin identification <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
