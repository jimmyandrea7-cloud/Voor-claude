import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import Layout, { Disclaimer } from "../components/Layout";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ink = (a) => `rgba(36,31,26,${a})`;
const specimenNo = (id) => (id ? id.slice(0, 8).toUpperCase() : "");
const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

export default function ScanResult() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [settings, setSettings] = useState(null);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    Promise.all([api.get(`/scans/${scanId}`), api.get("/settings"), api.get("/brands")])
      .then(([s, st, b]) => { setScan(s.data); setSettings(st.data); setBrands(b.data); })
      .catch(() => { toast.error("Report not found"); navigate("/dashboard"); });
  }, [scanId, navigate]);

  if (!scan) return <Layout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div></Layout>;

  const r = scan.result || {};
  const brandName = brands.find((b) => b.id === scan.brand_id)?.name || "";
  const price = settings?.report_price_display || "€ 4,99";

  return (
    <Layout>
      {scan.paid ? <FullReport scan={scan} r={r} brandName={brandName} /> : <Preliminary scan={scan} r={r} price={price} navigate={navigate} />}
    </Layout>
  );
}

function ConfidenceBar({ value, height = 14 }) {
  return (
    <div style={{ height, border: `1px solid ${ink(0.3)}`, display: "flex" }}>
      <div style={{ width: `${value}%`, background: "#B8420E" }} />
    </div>
  );
}

function Preliminary({ scan, r, price, navigate }) {
  const conf = r.confidence_percentage ?? 0;
  const photoUrl = (slot) => {
    const p = (scan.photos || []).find((p) => p.slot === slot);
    return p ? `${API}/files/${p.file_id}` : null;
  };
  const thumbSlots = ["caseback", "lugs_crown", "movement"];
  const withheld = ["Case reference", "Calibre", "Serial range and year", "Dial variant, plate by plate"];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]" style={{ borderBottom: "2px solid #241F1A" }}>
        <span>RefCheck — specimen {specimenNo(scan.id)}</span>
        <span style={{ color: ink(0.5) }}>Step 02 of 03 · Preliminary result</span>
        <span className="text-[#B8420E]">Free</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div style={{ borderRight: "2px solid #241F1A" }}>
          <div className="relative" style={{ aspectRatio: "4/3", background: "#9C958A", borderBottom: `1px solid ${ink(0.25)}` }}>
            {photoUrl("dial") && <img src={photoUrl("dial")} alt="" className="w-full h-full object-cover" style={{ filter: "grayscale(1)" }} />}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1, background: ink(0.25) }}>
            {thumbSlots.map((slot) => (
              <div key={slot} className="relative" style={{ minWidth: 0, aspectRatio: "1/1", background: "#9C958A" }}>
                {photoUrl(slot) && <img src={photoUrl(slot)} alt="" className="w-full h-full object-cover" style={{ filter: "grayscale(1)" }} />}
              </div>
            ))}
          </div>
          <div className="px-6 md:px-8 py-4 font-mono text-[12px] leading-[1.6]" style={{ color: ink(0.62) }}>
            Frames received {formatDate(scan.created_at)} · {(scan.photos || []).length} of 4 usable
          </div>
        </div>

        <div className="px-6 md:px-10 py-11">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#B8420E]">Preliminary — free</div>
          <h1 className="font-serif font-normal mt-4" style={{ fontSize: 44, lineHeight: 1.06 }} data-testid="result-model-family">
            {r.preliminary_summary || "Analysis pending."}
          </h1>
          {r.headline_highlights?.length > 0 && (
            <p className="mt-4" style={{ maxWidth: "52ch", fontSize: 16, lineHeight: 1.55, color: ink(0.8) }}>
              {r.headline_highlights.join(" ")}
            </p>
          )}

          <div className="flex items-baseline justify-between mt-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Confidence</div>
            <div className="font-serif text-[40px] leading-none text-[#B8420E]" data-testid="confidence-value">{conf}%</div>
          </div>
          <div className="mt-3"><ConfidenceBar value={conf} /></div>
          <div className="mt-3 font-mono text-[12px] leading-[1.5]" style={{ color: ink(0.62) }}>{r.confidence_note}</div>

          {conf < 40 && r.additional_photo_suggestion && (
            <div className="mt-5 font-mono text-[12px] leading-[1.5] p-4" style={{ border: `1px solid ${ink(0.25)}`, color: ink(0.7) }} data-testid="low-confidence-note">
              The evidence is thin, so this remains uncertain. {r.additional_photo_suggestion}
            </div>
          )}

          <div className="mt-9" style={{ borderTop: "2px solid #241F1A" }}>
            <Row label="Maker" value={r.maker} />
            <Row label="Family" value={r.family} />
            <Row label="Period" value={r.estimated_period} />
            {withheld.map((w) => <Row key={w} label={w} value="Withheld — full report" muted />)}
          </div>

          <div className="flex gap-3 mt-8 flex-wrap">
            <button onClick={() => navigate(`/unlock/${scan.id}`)} data-testid="unlock-report-button" className="btn" style={{ minWidth: 250 }}>
              Unlock the full report — {price}
            </button>
            <button onClick={() => navigate(`/scan/${scan.id}`)} className="btn-outline">Add a better frame</button>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-9"><Disclaimer /></div>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between gap-4 py-3.5" style={{ borderBottom: `1px solid ${ink(0.15)}`, color: muted ? ink(0.45) : "#241F1A" }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={muted ? { color: "inherit" } : { color: ink(0.55) }}>{label}</span>
      <span className={muted ? "font-mono text-[10px] uppercase tracking-[0.1em]" : "text-[15px]"}>{value || "—"}</span>
    </div>
  );
}

function FullReport({ scan, r, brandName }) {
  const photoUrl = (slot) => {
    const p = (scan.photos || []).find((p) => p.slot === slot);
    return p ? `${API}/files/${p.file_id}` : null;
  };
  const plates = [
    { slot: "dial", caption: "Plate 1 — dial" },
    { slot: "caseback", caption: "Plate 2 — case back" },
    { slot: "movement", caption: "Plate 3 — movement" },
  ];
  const summary = r.attribute_summary || { matched: 0, unresolved: 0, contradicted: 0 };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 md:px-10 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em]" style={{ borderBottom: "2px solid #241F1A" }}>
        <span>RefCheck — report {specimenNo(scan.id)}</span>
        <span style={{ color: ink(0.5) }}>Issued {formatDate(scan.created_at)} · v1</span>
        <button onClick={() => window.print()} className="text-[#B8420E] hover:text-[#8F3309]">Print</button>
      </div>

      <div className="px-6 md:px-10 py-11" style={{ borderBottom: "2px solid #241F1A" }}>
        <div className="grid gap-10 items-end" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#B8420E]">Documented identification</div>
            <h1 className="font-serif font-normal mt-4" style={{ fontSize: 52, lineHeight: 1.04 }}>
              {brandName} {r.family}<br />{r.case_reference ? `Ref. ${r.case_reference}` : ""}
            </h1>
            <div className="mt-4 font-mono text-[13px] leading-[1.7]" style={{ color: ink(0.7) }}>
              {[r.calibre && `Calibre ${r.calibre}`, r.serial_range && `Serial ${r.serial_range}`, r.estimated_period].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: ink(0.55) }}>Overall confidence</span>
              <span className="font-serif text-[48px] leading-none text-[#B8420E]" data-testid="confidence-value">{r.confidence_percentage}%</span>
            </div>
            <div className="mt-3"><ConfidenceBar value={r.confidence_percentage} height={16} /></div>
            <div className="mt-3 font-mono text-[12px] leading-[1.6]" style={{ color: ink(0.62) }}>
              {summary.matched} attributes matched · {summary.unresolved} unresolved · {summary.contradicted} contradicted
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", borderBottom: "2px solid #241F1A" }}>
        {plates.map((p, i) => (
          <div key={p.slot} style={{ borderRight: i < plates.length - 1 ? `1px solid ${ink(0.2)}` : "none" }}>
            <div className="relative" style={{ aspectRatio: "4/3", background: "#9C958A" }}>
              {photoUrl(p.slot) && <img src={photoUrl(p.slot)} alt="" className="w-full h-full object-cover" style={{ filter: "grayscale(1)" }} />}
            </div>
            <div className="px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: ink(0.6) }}>{p.caption}</div>
          </div>
        ))}
      </div>

      <div className="px-6 md:px-10 pt-11 pb-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ink(0.55) }}>Section 01 — Matched attributes</div>
      </div>
      <div className="px-6 md:px-10 pt-5 overflow-x-auto" data-testid="full-report">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderTop: "2px solid #241F1A", borderBottom: "2px solid #241F1A" }}>
              {["Attribute", "Finding", "Source", "Match"].map((h) => (
                <th key={h} className="text-left font-mono text-[10px] uppercase tracking-[0.12em] py-3 px-4 first:pl-0" style={{ color: ink(0.6) }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(r.matched_attributes || []).map((m, i) => {
              const unresolved = /unresolved|contradicted/i.test(m.match || "");
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${ink(0.15)}`, color: unresolved ? ink(0.7) : "inherit" }}>
                  <td className="py-3.5 pr-4 pl-0 text-[15px]">{m.attribute}</td>
                  <td className="py-3.5 px-4 text-[15px]">{m.finding}</td>
                  <td className="py-3.5 px-4 font-mono text-[12px]" style={{ color: ink(0.65) }}>{m.source}</td>
                  <td className="py-3.5 pl-4 font-mono text-[12px]" style={{ color: unresolved ? ink(0.6) : "#B8420E" }}>{m.match}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid mt-11" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", borderTop: "2px solid #241F1A" }}>
        <Section title="Section 02 — Reading" text={r.reading} border />
        <Section title="Section 03 — Unresolved" text={r.unresolved_note || "Nothing significant is unresolved."} border />
        <Section title="Section 04 — Scope" text={`An identification against verified ${brandName} reference data, on the frames supplied. Not a valuation, and not an authentication certificate. Reference data as catalogued ${new Date().toLocaleDateString(undefined, { month: "2-digit", year: "numeric" })}.`} />
      </div>

      <div className="flex gap-3 flex-wrap px-6 md:px-10 py-9" style={{ borderTop: "2px solid #241F1A" }}>
        <a href="/scan" className="btn-ink" style={{ minWidth: 220, display: "inline-flex", alignItems: "center" }}>Identify another watch</a>
      </div>
    </div>
  );
}

function Section({ title, text, border }) {
  return (
    <div className="px-6 md:px-10 py-9" style={{ borderRight: border ? `1px solid ${ink(0.2)}` : "none" }}>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ink(0.55) }}>{title}</div>
      <p className="mt-4 m-0" style={{ fontSize: 16, lineHeight: 1.6, color: ink(0.85) }}>{text}</p>
    </div>
  );
}
