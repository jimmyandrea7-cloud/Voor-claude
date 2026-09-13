import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { API } from "../lib/api";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

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

  const requiredDone = PHOTO_SLOTS.filter((s) => s.required).every((s) => photos[s.id]);

  const runAnalysis = async (e) => {
    e.preventDefault();
    if (!requiredDone) { toast.error("Please add the three required photographs first."); return; }
    setAnalyzing(true);
    try {
      await api.put(`/scans/${scanId}/description`, { notes });
      await api.post(`/scans/${scanId}/analyze`);
      navigate(`/report/${scanId}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Analysis failed. Please try again.");
      setAnalyzing(false);
    }
  };

  if (loadingScan) return <div style={{ display: "flex", justifyContent: "center", padding: "96px 0" }}><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (analyzing) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "96px 24px" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(36,31,26,.2)", borderTopColor: "var(--ink)" }} className="rc-spin-slow" />
        <h2 className="h-screen" style={{ marginTop: 28, fontSize: 32 }}>Under examination</h2>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {STAGES.map((s, i) => (
            <div key={s} className="body" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: i <= stageIdx ? "var(--ink)" : "var(--ink-45)" }}>
              {i < stageIdx ? <Check className="w-4 h-4" /> : i === stageIdx ? <Loader2 className="w-4 h-4 animate-spin" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid rgba(36,31,26,.3)" }} />}
              {s}
            </div>
          ))}
        </div>
        <p className="mono-note" style={{ marginTop: 36 }}>This can take up to a minute. Please keep this page open.</p>
      </div>
    );
  }

  return (
    <>
      <header className="bar" style={{ borderBottom: "var(--rule-strong)" }}>
        <span className="label">RefCheck — new specimen</span>
        <span className="label muted">Step 01 of 03 · Photograph</span>
        <span className="label muted">{scanId ? `No. ${scanId.slice(0, 8)}` : "No. pending"}</span>
      </header>

      <section className="cols">
        <div className="divider-r" style={{ padding: "44px 40px" }}>
          <h1 className="h-screen" style={{ fontSize: 40, lineHeight: 1.08, maxWidth: "22ch" }}>Four frames. Flat light, no flash.</h1>
          <p className="body" style={{ marginTop: 16, maxWidth: "52ch" }}>The dial and case back carry most of the evidence. The movement frame is optional, and raises confidence the most.</p>

          <div className="frame-grid" style={{ marginTop: 32, opacity: scanId ? 1 : 0.4, pointerEvents: scanId ? "auto" : "none" }}>
            {PHOTO_SLOTS.map((slot) => {
              const has = photos[slot.id];
              return (
                <label key={slot.id} className="photo photo-1x1" style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} data-testid={`photo-slot-${slot.id}`}>
                  <input ref={(el) => (fileRefs.current[slot.id] = el)} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => handleFile(slot.id, e.target.files[0])} data-testid={`file-input-${slot.id}`} />
                  {has ? (
                    <img src={has.preview || `${API}/files/${has.file_id}`} alt="" />
                  ) : uploading === slot.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--parchment)" }} />
                  ) : (
                    <span className="label label-sm" style={{ color: "var(--parchment)" }}>{slot.label}</span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="mono-note" style={{ marginTop: 18 }}>Drag a photograph onto a frame, or click it to browse. JPEG, PNG or WEBP.</p>
        </div>

        <div style={{ padding: "44px 40px" }}>
          <div className="label label-sm muted">Maker</div>
          <div style={{ marginTop: 16, borderTop: "var(--rule-25)" }}>
            {brands.map((b) => (
              <div
                key={b.id}
                className={`row${!b.active ? " is-unavailable" : ""}`}
                style={{ alignItems: "baseline", opacity: !b.active ? 0.45 : 1, cursor: b.active && !scanId ? "pointer" : "default" }}
                onClick={() => pickBrand(b)}
                data-testid={`maker-row-${b.name.toLowerCase()}`}
              >
                <span className="h-step">{b.name}</span>
                {b.active
                  ? <span className="label accent">{brandId === b.id ? "Selected" : "Select"}</span>
                  : <span className="tag tag-pending">{b.coming_soon_label || "Not yet available"}</span>}
              </div>
            ))}
          </div>
          <p className="mono-note" style={{ marginTop: 14 }}>Choose the maker printed on the dial. If it isn't listed as available, we can't cross-check it yet.</p>

          <form onSubmit={runAnalysis}>
            <div className="label label-sm muted" style={{ marginTop: 36 }}>Anything you already know</div>
            <input
              className="input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Serial number, inscription, family papers…"
              style={{ marginTop: 12 }}
              disabled={!scanId}
              data-testid="desc-notes"
            />
            <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 32 }} disabled={!scanId || !requiredDone} data-testid="run-analysis-btn">
              Run the cross-check.
            </button>
          </form>
          <p className="mono-note" style={{ marginTop: 14 }}>The preliminary result is free. Nothing is charged at this step.</p>
        </div>
      </section>
    </>
  );
}
