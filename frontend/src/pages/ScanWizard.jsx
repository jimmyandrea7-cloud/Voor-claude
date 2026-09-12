import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Camera, Check, ArrowRight, ArrowLeft, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

const PHOTO_SLOTS = [
  { id: "dial", label: "Full dial", required: true, reason: "Straight-on. Logo, handset, indices and patina." },
  { id: "caseback", label: "Case back", required: true, reason: "Engravings, medallions and case numbers." },
  { id: "serial", label: "Serial / reference", required: true, reason: "Usually between the lugs or inside the case back." },
  { id: "lug_profile", label: "Lug & case profile", required: true, reason: "Side view — polishing history and case sharpness." },
  { id: "crown", label: "Crown", required: false, reason: "Confirms an original Ω-signed crown." },
  { id: "movement", label: "Movement", required: false, reason: "If it opens: the calibre number dates it precisely." },
  { id: "strap", label: "Bracelet & clasp", required: false, reason: "End-links and clasp codes confirm a period-correct bracelet." },
];

const CONDITIONS = ["working", "not working", "unknown"];
const BOX_PAPERS = ["yes", "no", "unsure"];
const STAGES = ["Reading the photographs", "Extracting serial & reference marks", "Cross-checking Omega reference data", "Weighing the confidence figure"];

export default function ScanWizard() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [photos, setPhotos] = useState({});
  const [uploading, setUploading] = useState(null);
  const [phase, setPhase] = useState("photos");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [desc, setDesc] = useState({ provenance: "", engravings: "", condition: "unknown", box_papers: "unsure", caseback_numbers: "" });
  const fileRefs = useRef({});

  useEffect(() => {
    api.get(`/scans/${scanId}`).then((r) => {
      setScan(r.data);
      const p = {};
      (r.data.photos || []).forEach((ph) => { p[ph.slot] = { file_id: ph.file_id }; });
      setPhotos(p);
      if (r.data.description) setDesc((d) => ({ ...d, ...r.data.description }));
    }).catch(() => { toast.error("Scan not found"); navigate("/scan"); });
  }, [scanId, navigate]);

  useEffect(() => {
    if (!analyzing) return;
    setStageIdx(0);
    const iv = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(iv);
  }, [analyzing]);

  const handleFile = async (slot, file) => {
    if (!file) return;
    if (!/image\/(jpe?g|png|webp)/.test(file.type)) { toast.error("Please use a JPEG, PNG or WEBP image."); return; }
    setUploading(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((p) => ({ ...p, [slot]: { file_id: res.data.file_id, preview: URL.createObjectURL(file) } }));
      toast.success(`${PHOTO_SLOTS.find((s) => s.id === slot).label} added`);
    } catch {
      toast.error("Upload failed. Try a smaller image.");
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (slot) => setPhotos((p) => { const n = { ...p }; delete n[slot]; return n; });

  const requiredDone = PHOTO_SLOTS.filter((s) => s.required).every((s) => photos[s.id]);
  const uploadedCount = Object.keys(photos).length;

  const savePhotos = async () => {
    const arr = Object.entries(photos).map(([slot, v]) => ({ slot, file_id: v.file_id, storage_path: "" }));
    await api.put(`/scans/${scanId}/photos`, { photos: arr });
  };

  const goDetails = async () => {
    if (!requiredDone) { toast.error("Please add the four required photographs first."); return; }
    await savePhotos();
    setPhase("details");
    window.scrollTo(0, 0);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await api.put(`/scans/${scanId}/description`, desc);
      await api.post(`/scans/${scanId}/analyze`);
      navigate(`/report/${scanId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Analysis failed. Please try again.");
      setAnalyzing(false);
    }
  };

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-[#2A2420] animate-spin" /></div></Layout>;

  if (analyzing) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-6 py-24">
          <div className="w-12 h-12 rounded-full border-2 border-[#E4E1DA] border-t-[#2A2420] rc-spin-slow" />
          <h2 className="mt-8 font-serif text-3xl text-[#2A2420]">Under examination</h2>
          <div className="mt-8 space-y-3.5">
            {STAGES.map((s, i) => (
              <div key={s} data-testid={`analysis-stage-${i}`} className={`flex items-center gap-3 text-[13px] transition-colors ${i <= stageIdx ? "text-[#2A2420]" : "text-[#B8B0A4]"}`}>
                {i < stageIdx ? <Check className="w-4 h-4" /> : i === stageIdx ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4 rounded-full border border-[#D8D3C8]" />}
                {s}
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-[#A79E92]">This can take up to a minute. Please keep this page open.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        {phase === "photos" ? (
          <>
            <div className="mb-9 rc-fade-up">
              <span className="eyebrow">Step 02 — Photographs</span>
              <h1 className="mt-4 font-serif text-4xl text-[#2A2420]">The record</h1>
              <p className="mt-3 text-[14px] text-[#6B6259]">Four angles are required. Each additional photograph sharpens the result.</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E4E1DA] relative">
                  <div className="absolute left-0 top-0 h-px bg-[#2A2420] transition-all" style={{ width: `${(uploadedCount / PHOTO_SLOTS.length) * 100}%` }} />
                </div>
                <span className="eyebrow">{uploadedCount} / {PHOTO_SLOTS.length}</span>
              </div>
            </div>

            <div className="border border-[#E4E1DA] rounded-[4px] divide-y divide-[#E4E1DA] bg-white">
              {PHOTO_SLOTS.map((slot) => {
                const has = photos[slot.id];
                return (
                  <div key={slot.id} className="p-4 flex gap-4 items-center" data-testid={`photo-slot-${slot.id}`}>
                    <div className="w-16 h-16 shrink-0 rounded-[3px] overflow-hidden border border-[#E4E1DA] bg-[#FAFAF8] flex items-center justify-center relative">
                      {has ? (
                        <>
                          <img src={has.preview || `${API}/files/${has.file_id}`} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removePhoto(slot.id)} data-testid={`remove-photo-${slot.id}`} className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-[#2A2420] hover:bg-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <Camera className="w-5 h-5 text-[#C7C2B7]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[#2A2420] font-medium text-[15px]">{slot.label}</h3>
                        {slot.required && <span className="text-[10px] uppercase tracking-[0.14em] text-[#A79E92]">Required</span>}
                      </div>
                      <p className="text-[12px] text-[#6B6259] mt-0.5 leading-relaxed">{slot.reason}</p>
                    </div>
                    <input ref={(el) => (fileRefs.current[slot.id] = el)} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(slot.id, e.target.files[0])} data-testid={`file-input-${slot.id}`} />
                    <button
                      onClick={() => fileRefs.current[slot.id]?.click()}
                      disabled={uploading === slot.id}
                      data-testid={`upload-btn-${slot.id}`}
                      className={`shrink-0 ${has ? "btn btn-outline btn-sm" : "btn btn-sm"}`}
                    >
                      {uploading === slot.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (has ? "Replace" : "Add")}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between items-center">
              <button onClick={() => navigate("/scan")} className="text-[#6B6259] hover:text-[#2A2420] inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
              <button onClick={goDetails} disabled={!requiredDone} data-testid="photos-continue-btn" className="btn">
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-9">
              <span className="eyebrow">Step 03 — Detail</span>
              <h1 className="mt-4 font-serif text-4xl text-[#2A2420]">What you know</h1>
              <p className="mt-3 text-[14px] text-[#6B6259]">Optional. Anything you add narrows the identification.</p>
            </div>

            <div className="space-y-6">
              <Field label="How the watch came to you" hint="Context only — not stored as sensitive data.">
                <input data-testid="desc-provenance" value={desc.provenance} onChange={(e) => setDesc({ ...desc, provenance: e.target.value })} placeholder="Inherited from my grandfather" className="field" />
              </Field>
              <Field label="Engravings or text">
                <textarea data-testid="desc-engravings" value={desc.engravings} onChange={(e) => setDesc({ ...desc, engravings: e.target.value })} rows={2} placeholder="On the case back, inside the caseband, on the movement…" className="field" />
              </Field>
              <Field label="Numbers on the case back or dial">
                <input data-testid="desc-numbers" value={desc.caseback_numbers} onChange={(e) => setDesc({ ...desc, caseback_numbers: e.target.value })} placeholder="145.022, serial 32104xxx" className="field" />
              </Field>
              <Field label="Condition">
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button key={c} data-testid={`condition-${c.replace(/\s+/g, "-")}`} onClick={() => setDesc({ ...desc, condition: c })} className={`chip ${desc.condition === c ? "chip-active" : ""}`}>{c}</button>
                  ))}
                </div>
              </Field>
              <Field label="Original box or papers">
                <div className="flex flex-wrap gap-2">
                  {BOX_PAPERS.map((c) => (
                    <button key={c} data-testid={`boxpapers-${c}`} onClick={() => setDesc({ ...desc, box_papers: c })} className={`chip ${desc.box_papers === c ? "chip-active" : ""}`}>{c}</button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-10 flex justify-between items-center">
              <button onClick={() => setPhase("photos")} className="text-[#6B6259] hover:text-[#2A2420] inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em]"><ArrowLeft className="w-3.5 h-3.5" /> Photographs</button>
              <button onClick={runAnalysis} data-testid="run-analysis-btn" className="btn">
                Identify <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[13px] text-[#2A2420] mb-2 font-medium">{label} {hint && <span className="text-[#A79E92] font-normal">— {hint}</span>}</label>
      {children}
    </div>
  );
}
