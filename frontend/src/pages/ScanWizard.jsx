import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

const ink = (a) => `rgba(36,31,26,${a})`;

const PHOTO_SLOTS = [
  { id: "dial", label: "01 — Dial, square on", required: true },
  { id: "caseback", label: "02 — Case back", required: true },
  { id: "lugs_crown", label: "03 — Lugs and crown", required: true },
  { id: "movement", label: "04 — Movement (optional)", required: false },
];

const STAGES = ["Reading the photographs", "Extracting serial & reference marks", "Cross-checking the archive", "Weighing the confidence figure"];

export default function ScanWizard() {
  const { scanId: scanIdParam } = useParams();
  const navigate = useNavigate();
  const [scanId, setScanId] = useState(scanIdParam || null);
  const [loadingScan, setLoadingScan] = useState(!!scanIdParam);
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState(null);
  const [creatingScan, setCreatingScan] = useState(false);
  const [photos, setPhotos] = useState({});
  const [uploading, setUploading] = useState(null);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const fileRefs = useRef({});

  useEffect(() => {
    api.get("/brands").then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!scanIdParam) return;
    api.get(`/scans/${scanIdParam}`).then((r) => {
      setBrandId(r.data.brand_id);
      const p = {};
      (r.data.photos || []).forEach((ph) => { p[ph.slot] = { file_id: ph.file_id }; });
      setPhotos(p);
      setNotes(r.data.description?.notes || "");
      setLoadingScan(false);
    }).catch(() => { toast.error("Scan not found"); navigate("/scan"); });
  }, [scanIdParam, navigate]);

  useEffect(() => {
    if (!analyzing) return;
    setStageIdx(0);
    const iv = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(iv);
  }, [analyzing]);

  const pickBrand = useCallback(async (brand) => {
    if (!brand.active || creatingScan || scanId) return;
    setCreatingScan(true);
    try {
      const res = await api.post("/scans", { brand_id: brand.id });
      setBrandId(brand.id);
      setScanId(res.data.id);
      navigate(`/scan/${res.data.id}`, { replace: true });
    } catch {
      toast.error("Could not start the identification. Please try again.");
    } finally {
      setCreatingScan(false);
    }
  }, [creatingScan, scanId, navigate]);

  const handleFile = async (slot, file) => {
    if (!file || !scanId) return;
    if (!/image\/(jpe?g|png|webp)/.test(file.type)) { toast.error("Please use a JPEG, PNG or WEBP image."); return; }
    setUploading(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const next = { ...photos, [slot]: { file_id: res.data.file_id, preview: URL.createObjectURL(file) } };
      setPhotos(next);
      const arr = Object.entries(next).map(([s, v]) => ({ slot: s, file_id: v.file_id, storage_path: "" }));
      await api.put(`/scans/${scanId}/photos`, { photos: arr });
    } catch {
      toast.error("Upload failed. Try a smaller image.");
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = async (slot) => {
    const next = { ...photos };
    delete next[slot];
    setPhotos(next);
    const arr = Object.entries(next).map(([s, v]) => ({ slot: s, file_id: v.file_id, storage_path: "" }));
    await api.put(`/scans/${scanId}/photos`, { photos: arr });
  };

  const requiredDone = PHOTO_SLOTS.filter((s) => s.required).every((s) => photos[s.id]);

  const runAnalysis = async () => {
    if (!requiredDone) { toast.error("Please add the three required photographs first."); return; }
    setAnalyzing(true);
    try {
      await api.put(`/scans/${scanId}/description`, { notes });
      await api.post(`/scans/${scanId}/analyze`);
      navigate(`/report/${scanId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Analysis failed. Please try again.");
      setAnalyzing(false);
    }
  };

  if (loadingScan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div></Layout>;

  if (analyzing) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-6 py-24">
          <div className="w-10 h-10 rounded-full border-2 rc-spin-slow" style={{ borderColor: ink(0.2), borderTopColor: "#241F1A" }} />
          <h2 className="mt-7 font-serif text-3xl">Under examination</h2>
          <div className="mt-7 space-y-3">
            {STAGES.map((s, i) => (
              <div key={s} data-testid={`analysis-stage-${i}`} className="flex items-center gap-3 text-[13px]" style={{ color: i <= stageIdx ? "#241F1A" : ink(0.4) }}>
                {i < stageIdx ? <Check className="w-4 h-4" /> : i === stageIdx ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4 rounded-full border" style={{ borderColor: ink(0.3) }} />}
                {s}
              </div>
            ))}
          </div>
          <p className="mt-9 font-mono text-xs" style={{ color: ink(0.5) }}>This can take up to a minute. Please keep this page open.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]" style={{ borderBottom: "2px solid #241F1A" }}>
        <span>RefCheck — new specimen</span>
        <span style={{ color: ink(0.5) }}>Step 01 of 03 · Photograph</span>
        <span style={{ color: ink(0.5) }}>{scanId ? `No. ${scanId.slice(0, 8)}` : "No. pending"}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <div className="px-6 md:px-10 py-11" style={{ borderRight: "2px solid #241F1A" }}>
          <h1 className="font-serif font-normal m-0" style={{ fontSize: 40, lineHeight: 1.08, maxWidth: "22ch" }}>Four frames. Flat light, no flash.</h1>
          <p className="mt-4" style={{ maxWidth: "52ch", fontSize: 16, lineHeight: 1.55, color: ink(0.8) }}>
            The dial and case back carry most of the evidence. The movement frame is optional, and raises confidence the most.
          </p>

          <div className="grid gap-[2px] mt-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", background: "#241F1A", padding: 2, opacity: scanId ? 1 : 0.4, pointerEvents: scanId ? "auto" : "none" }}>
            {PHOTO_SLOTS.map((slot) => {
              const has = photos[slot.id];
              return (
                <div key={slot.id} className="relative" style={{ background: "#9C958A", aspectRatio: "1/1" }} data-testid={`photo-slot-${slot.id}`}>
                  {has ? (
                    <>
                      <img src={has.preview || `${API}/files/${has.file_id}`} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(slot.id)} data-testid={`remove-photo-${slot.id}`} className="absolute top-2 right-2" style={{ background: "rgba(36,31,26,.75)", padding: 4 }}>
                        <X className="w-3.5 h-3.5" style={{ color: "#F3EEE3" }} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileRefs.current[slot.id]?.click()}
                      disabled={uploading === slot.id}
                      data-testid={`upload-btn-${slot.id}`}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-center px-2"
                      style={{ color: "#F3EEE3" }}
                    >
                      {uploading === slot.id ? <Loader2 className="w-4 h-4 animate-spin" /> : slot.label}
                    </button>
                  )}
                  <input ref={(el) => (fileRefs.current[slot.id] = el)} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(slot.id, e.target.files[0])} data-testid={`file-input-${slot.id}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.6) }}>
            Drag a photograph onto a frame, or click it to browse. JPEG, PNG or WEBP.
          </div>
        </div>

        <div className="px-6 md:px-10 py-11">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Maker</div>
          <div className="mt-4" style={{ borderTop: `1px solid ${ink(0.25)}` }}>
            {brands.map((b) => {
              const selected = brandId === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => pickBrand(b)}
                  data-testid={`maker-row-${b.name.toLowerCase()}`}
                  className="flex items-baseline justify-between gap-3 py-4"
                  style={{ borderBottom: `1px solid ${ink(0.15)}`, cursor: b.active && !scanId ? "pointer" : "default", opacity: !b.active ? 0.45 : 1 }}
                >
                  <span className="font-serif text-[22px]">{b.name}</span>
                  {b.active ? (
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#B8420E]">{selected ? "Selected" : (scanId ? "" : "Select")}</span>
                  ) : (
                    <span className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: 9, border: "1px solid #241F1A", padding: "4px 6px" }}>{b.coming_soon_label || "Not yet available"}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.6) }}>
            Choose the maker printed on the dial. If it isn't listed as available, we can't cross-check it yet.
          </div>

          <div className="mt-9 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Anything you already know</div>
          <input
            data-testid="desc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Serial number, inscription, family papers…"
            className="field mt-3"
            disabled={!scanId}
          />

          <button onClick={runAnalysis} disabled={!scanId || !requiredDone} data-testid="run-analysis-btn" className="btn w-full mt-8" style={{ justifyContent: "flex-start" }}>
            Run the cross-check.
          </button>
          <div className="mt-3.5 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.6) }}>
            The preliminary result is free. Nothing is charged at this step.
          </div>
        </div>
      </div>
    </Layout>
  );
}
