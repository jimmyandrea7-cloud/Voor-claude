import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Loader2, Plus } from "lucide-react";
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
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <span className="eyebrow">{user?.name ? user.name.split(" ")[0] + "'s collection" : "Collection"}</span>
            <h1 className="mt-3 font-serif text-4xl md:text-5xl text-[#2A2420]">The collection</h1>
            <p className="mt-2 text-[14px] text-[#6B6259]">Every watch you have brought in for identification.</p>
          </div>
          <button onClick={() => navigate("/scan")} data-testid="new-scan-btn" className="btn">
            <Plus className="w-3.5 h-3.5" /> New Identification
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#2A2420] animate-spin" /></div>
        ) : scans.length === 0 ? (
          <div className="card rounded-[4px] p-14 text-center" data-testid="empty-collection">
            <h3 className="font-serif text-3xl text-[#2A2420]">Nothing here yet</h3>
            <p className="mt-3 text-[14px] text-[#6B6259]">Bring in your first watch to begin the collection.</p>
            <button onClick={() => navigate("/scan")} className="btn mt-7">Begin identification</button>
          </div>
        ) : (
          <div className="border border-[#E4E1DA] rounded-[4px] overflow-hidden bg-white">
            {scans.map((s, i) => {
              const conf = s.result?.confidence_percentage ?? s.confidence_score ?? null;
              const analyzed = s.status === "analyzed";
              return (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="border-b border-[#E4E1DA] last:border-b-0">
                  <Link to={analyzed ? `/report/${s.id}` : `/scan/${s.id}`} data-testid={`scan-card-${s.id}`} className="flex items-center gap-5 px-6 py-5 hover:bg-[#FAFAF8] transition-colors">
                    <div className="w-14 text-center shrink-0">
                      {conf != null && analyzed ? (
                        <>
                          <div className="font-serif text-2xl text-[#2A2420] leading-none">{conf}</div>
                          <div className="eyebrow mt-1" style={{ fontSize: 9 }}>Conf.</div>
                        </>
                      ) : (
                        <div className="eyebrow" style={{ fontSize: 9 }}>{analyzed ? "—" : "Draft"}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-xl text-[#2A2420] truncate">{s.result?.likely_model_family || "Awaiting analysis"}</h3>
                      <p className="text-[12px] text-[#A79E92] mt-0.5">{new Date(s.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                    </div>
                    <span className="eyebrow shrink-0">{analyzed ? (s.paid ? "Unlocked" : "Locked") : "Draft"}</span>
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
