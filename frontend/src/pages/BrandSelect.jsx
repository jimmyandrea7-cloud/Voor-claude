import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { Loader2, ArrowRight } from "lucide-react";
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
      toast.error("Could not start the identification. Please try again.");
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-14">
        <div className="mb-12 rc-fade-up">
          <span className="eyebrow">Step 01 — Maison</span>
          <h1 className="mt-4 font-serif text-4xl md:text-5xl text-[#2A2420]">Select the maison</h1>
          <p className="mt-3 text-[14px] text-[#6B6259] max-w-md">
            Omega is documented in full, from the 1930s onward. Other houses will follow as their references are verified.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#2A2420] animate-spin" /></div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-px bg-[#E4E1DA] border border-[#E4E1DA] rounded-[4px] overflow-hidden">
            {brands.map((b) => (
              <button
                key={b.id}
                data-testid={`brand-card-${b.name.toLowerCase().replace(/\s+/g, "-")}`}
                disabled={!b.active || creating}
                onClick={() => startScan(b)}
                className={`text-left bg-white p-7 transition-colors group ${
                  b.active ? "hover:bg-[#FAFAF8] cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-serif text-3xl text-[#2A2420]">{b.name}</h3>
                  <span className="eyebrow mt-1">{b.active ? "Documented" : b.coming_soon_label || "Soon"}</span>
                </div>
                <p className="mt-2 text-[13px] text-[#6B6259]">{b.tagline}</p>
                {b.active && (
                  <div className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#2A2420] group-hover:gap-3 transition-all">
                    Begin <ArrowRight className="w-3.5 h-3.5" />
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
