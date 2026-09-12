import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Loader2, Plus, Lock, Unlock, Watch, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/scans").then((r) => setScans(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-9">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</span>
            <h1 className="mt-2 font-serif text-4xl text-slate-100">My Collection</h1>
            <p className="mt-1 text-slate-400">Your identified and appraised timepieces.</p>
          </div>
          <button onClick={() => navigate("/scan")} data-testid="new-scan-btn" className="rc-gold-btn px-5 py-3 rounded-full font-semibold inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Identification
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin" /></div>
        ) : scans.length === 0 ? (
          <div className="rc-card rounded-2xl p-12 text-center" data-testid="empty-collection">
            <Watch className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="mt-4 font-serif text-2xl text-slate-100">No watches yet</h3>
            <p className="mt-2 text-slate-400 text-sm">Start your first identification to build your collection.</p>
            <button onClick={() => navigate("/scan")} className="mt-6 rc-gold-btn px-6 py-3 rounded-full font-semibold">Identify a watch</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scans.map((s, i) => {
              const conf = s.result?.confidence_percentage ?? s.confidence_score ?? null;
              const analyzed = s.status === "analyzed";
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={analyzed ? `/report/${s.id}` : `/scan/${s.id}`} data-testid={`scan-card-${s.id}`} className="block rc-card rounded-2xl p-5 hover:border-[#D4AF37]/40 transition-colors h-full">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                      {analyzed ? (
                        s.paid
                          ? <span className="inline-flex items-center gap-1 text-[10px] text-[#D4AF37]"><Unlock className="w-3 h-3" /> Unlocked</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Lock className="w-3 h-3" /> Locked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400"><Clock className="w-3 h-3" /> Draft</span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl text-slate-100 leading-snug min-h-[3.5rem]">{s.result?.likely_model_family || "Awaiting analysis"}</h3>
                    {conf != null && analyzed && (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                          <div className="h-full rc-gold-btn" style={{ width: `${conf}%` }} />
                        </div>
                        <span className="text-sm font-serif text-slate-200">{conf}%</span>
                      </div>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
