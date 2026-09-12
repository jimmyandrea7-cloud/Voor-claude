import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Camera, Check, Upload, ArrowRight, ArrowLeft, Loader2, Info, X } from "lucide-react";
import { motion } from "framer-motion";

const PHOTO_SLOTS = [
  { id: "dial", label: "Full Dial / Face", required: true, reason: "Evaluates logo font, hand style, sub-dials, hour markers and patina — the single most telling photo." },
  { id: "caseback", label: "Case Back", required: true, reason: "Reveals medallions (e.g. Seamaster Hippocampus), case numbers and water-resistance hallmarks." },
  { id: "serial", label: "Serial / Ref Stamp", required: true, reason: "Pinpoints the production batch and reference code, usually on the inner case back or between the lugs." },
  { id: "lug_profile", label: "Lug & Case Profile", required: true, reason: "Shows polish history, lug bevels and case thickness — key to originality." },
  { id: "crown", label: "Crown Close-up", required: false, reason: "Confirms an original Ω-stamped crown versus an aftermarket replacement." },
  { id: "movement", label: "Caliber / Movement", required: false, reason: "If the case back opens or is transparent, the caliber number narrows the era dramatically." },
  { id: "strap", label: "Bracelet / Clasp", required: false, reason: "End-link and clasp codes help confirm a period-correct bracelet." },
];

const CONDITIONS = ["working", "not working", "unknown"];
const BOX_PAPERS = ["yes", "no", "unsure"];

export default function ScanWizard() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [photos, setPhotos] = useState({}); // slot -> {file_id, preview}
  const [uploading, setUploading] = useState(null);
  const [phase, setPhase] = useState("photos"); // photos | details
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [desc, setDesc] = useState({ provenance: "", engravings: "", condition: "unknown", box_papers: "unsure", caseback_numbers: "" });
  const fileRefs = useRef({});

  const STAGES = ["Uploading photographs", "Extracting optical features", "Cross-referencing the Omega reference database", "Calculating confidence score"];

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
    if (!requiredDone) { toast.error("Please add the four required photos first."); return; }
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

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin" /></div></Layout>;

  if (analyzing) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rc-spin-slow" />
          <h2 className="mt-8 font-serif text-3xl text-slate-100">Examining your watch</h2>
          <div className="mt-8 space-y-3 text-left">
            {STAGES.map((s, i) => (
              <div key={s} data-testid={`analysis-stage-${i}`} className={`flex items-center gap-3 text-sm transition-colors ${i <= stageIdx ? "text-slate-200" : "text-slate-600"}`}>
                {i < stageIdx ? <Check className="w-4 h-4 text-[#D4AF37]" /> : i === stageIdx ? <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                {s}
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-500">This can take up to a minute. Please keep this page open.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        {phase === "photos" ? (
          <>
            <div className="mb-8 rc-fade-up">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Step 2 of 4 · Photographs</span>
              <h1 className="mt-3 font-serif text-4xl text-slate-100">Capture your Omega</h1>
              <p className="mt-2 text-slate-400">Four photos are required (marked ●). The more you add, the higher the confidence.</p>
              <div className="mt-4 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                <div className="h-full rc-gold-btn transition-all" style={{ width: `${(uploadedCount / PHOTO_SLOTS.length) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              {PHOTO_SLOTS.map((slot) => {
                const has = photos[slot.id];
                return (
                  <div key={slot.id} className={`rc-card rounded-xl p-4 flex gap-4 items-center ${has ? "border-[#D4AF37]/30" : ""}`} data-testid={`photo-slot-${slot.id}`}>
                    <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-[#1E293B] bg-[#0F172A] flex items-center justify-center relative">
                      {has ? (
                        <>
                          <img src={has.preview || `${API}/files/${has.file_id}`} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removePhoto(slot.id)} data-testid={`remove-photo-${slot.id}`} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-slate-200 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <Camera className="w-6 h-6 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-slate-100 font-medium">{slot.label}</h3>
                        {slot.required && <span className="text-[#D4AF37] text-xs">●</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1 leading-relaxed"><Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />{slot.reason}</p>
                    </div>
                    <input ref={(el) => (fileRefs.current[slot.id] = el)} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(slot.id, e.target.files[0])} data-testid={`file-input-${slot.id}`} />
                    <button
                      onClick={() => fileRefs.current[slot.id]?.click()}
                      disabled={uploading === slot.id}
                      data-testid={`upload-btn-${slot.id}`}
                      className={`shrink-0 px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5 transition-colors ${has ? "text-slate-400 hover:text-slate-100 border border-[#1E293B]" : "rc-gold-btn font-medium"}`}
                    >
                      {uploading === slot.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {has ? "Replace" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between items-center">
              <button onClick={() => navigate("/scan")} className="text-slate-400 hover:text-slate-100 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="w-4 h-4" /> Back</button>
              <button onClick={goDetails} disabled={!requiredDone} data-testid="photos-continue-btn" className="rc-gold-btn px-6 py-3 rounded-full font-semibold inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">Step 3 of 4 · Details</span>
              <h1 className="mt-3 font-serif text-4xl text-slate-100">Tell us a little more</h1>
              <p className="mt-2 text-slate-400">Optional, but every detail sharpens the identification.</p>
            </div>

            <div className="space-y-5">
              <Field label="Where / how did you get this watch?" hint="For context only — not stored as sensitive data.">
                <input data-testid="desc-provenance" value={desc.provenance} onChange={(e) => setDesc({ ...desc, provenance: e.target.value })} placeholder="e.g. Inherited from my grandfather" className={inputCls} />
              </Field>
              <Field label="Any visible engravings or text?">
                <textarea data-testid="desc-engravings" value={desc.engravings} onChange={(e) => setDesc({ ...desc, engravings: e.target.value })} rows={2} placeholder="Text on the case back, inside the caseband, on the movement…" className={inputCls} />
              </Field>
              <Field label="Any numbers on the case back or dial?">
                <input data-testid="desc-numbers" value={desc.caseback_numbers} onChange={(e) => setDesc({ ...desc, caseback_numbers: e.target.value })} placeholder="e.g. 145.022, serial 32104xxx" className={inputCls} />
              </Field>
              <Field label="Approximate condition">
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button key={c} data-testid={`condition-${c.replace(/\s+/g, "-")}`} onClick={() => setDesc({ ...desc, condition: c })} className={pill(desc.condition === c)}>{c}</button>
                  ))}
                </div>
              </Field>
              <Field label="Original box / papers?">
                <div className="flex flex-wrap gap-2">
                  {BOX_PAPERS.map((c) => (
                    <button key={c} data-testid={`boxpapers-${c}`} onClick={() => setDesc({ ...desc, box_papers: c })} className={pill(desc.box_papers === c)}>{c}</button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-9 flex justify-between items-center">
              <button onClick={() => setPhase("photos")} className="text-slate-400 hover:text-slate-100 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="w-4 h-4" /> Photos</button>
              <button onClick={runAnalysis} data-testid="run-analysis-btn" className="rc-gold-btn px-7 py-3 rounded-full font-semibold inline-flex items-center gap-2">
                Identify my watch <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

const inputCls = "w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm";
const pill = (active) => `px-4 py-2 rounded-full text-sm capitalize transition-colors ${active ? "rc-gold-btn font-medium" : "border border-[#1E293B] text-slate-400 hover:text-slate-100"}`;

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-2">{label} {hint && <span className="text-slate-600 text-xs">— {hint}</span>}</label>
      {children}
    </div>
  );
}
