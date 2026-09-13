import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  if (!scan) return <div style={{ display: "flex", justifyContent: "center", padding: "96px 0" }}><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const r = scan.result || {};
  const brandName = brands.find((b) => b.id === scan.brand_id)?.name || "";
  const price = settings?.report_price_display || "€ 4,99";

  return scan.paid ? <FullReport scan={scan} r={r} brandName={brandName} /> : <Preliminary scan={scan} r={r} price={price} navigate={navigate} />;
}

function Preliminary({ scan, r, price, navigate }) {
  const conf = r.confidence_percentage ?? 0;
  const photoUrl = (slot) => {
    const p = (scan.photos || []).find((p) => p.slot === slot);
    return p ? `${API}/files/${p.file_id}` : null;
  };
  const thumbSlots = ["caseback", "lugs_crown", "movement"];

  return (
    <>
      <header className="bar" style={{ borderBottom: "var(--rule-strong)" }}>
        <span className="label">RefCheck — specimen {specimenNo(scan.id)}</span>
        <span className="label muted">Step 02 of 03 · Preliminary result</span>
        <span className="label accent">Free</span>
      </header>

      <section className="cols" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <div className="divider-r">
          <div className="photo photo-4x3" style={{ borderBottom: "var(--rule-25)" }}>
            {photoUrl("dial") && <img src={photoUrl("dial")} alt="" />}
          </div>
          <div className="photo-grid">
            {thumbSlots.map((slot) => (
              <div key={slot} className="photo photo-1x1">
                {photoUrl(slot) && <img src={photoUrl(slot)} alt="" />}
              </div>
            ))}
          </div>
          <p className="mono-note" style={{ padding: "18px 32px" }}>
            Frames received {formatDate(scan.created_at)} · {(scan.photos || []).length} of 4 usable
          </p>
        </div>

        <div style={{ padding: "40px 40px 44px" }}>
          <div className="label label-kicker accent">Preliminary — free</div>
          <h1 className="h-screen" style={{ marginTop: 18 }} data-testid="result-model-family">
            {r.preliminary_summary || "Analysis pending."}
          </h1>
          <p className="body" style={{ marginTop: 16, maxWidth: "52ch" }}>
            {r.headline_highlights?.length > 0 ? r.headline_highlights.join(" ") : "The reasoning behind this reading is shown below."}
          </p>

          <div className="conf-head" style={{ marginTop: 34 }}>
            <span className="label label-sm muted">Confidence</span>
            <span className="figure-lg" style={{ fontSize: 40 }} data-testid="confidence-value">{conf}%</span>
          </div>
          <div className="conf-bar"><i style={{ width: `${conf}%` }} /></div>
          <p className="mono-note" style={{ marginTop: 12 }}>{r.confidence_note}</p>

          {conf < 40 && r.additional_photo_suggestion && (
            <p className="mono-note" style={{ marginTop: 16, padding: 14, border: "var(--rule-20)" }} data-testid="low-confidence-note">
              The evidence is thin, so this remains uncertain. {r.additional_photo_suggestion}
            </p>
          )}

          <div className="rows" style={{ marginTop: 36 }}>
            <div className="row"><span className="label label-sm muted">Maker</span><span style={{ fontSize: 15 }}>{r.maker || "—"}</span></div>
            <div className="row"><span className="label label-sm muted">Family</span><span style={{ fontSize: 15 }}>{r.family || "—"}</span></div>
            <div className="row"><span className="label label-sm muted">Period</span><span style={{ fontSize: 15 }}>{r.estimated_period || "—"}</span></div>
            <div className="row row-withheld"><span className="label label-sm">Case reference</span><span className="label label-sm">Withheld — full report</span></div>
            <div className="row row-withheld"><span className="label label-sm">Calibre</span><span className="label label-sm">Withheld — full report</span></div>
            <div className="row row-withheld"><span className="label label-sm">Serial range and year</span><span className="label label-sm">Withheld — full report</span></div>
            <div className="row row-withheld"><span className="label label-sm">Dial variant, plate by plate</span><span className="label label-sm">Withheld — full report</span></div>
          </div>

          <div className="btn-row" style={{ marginTop: 32 }}>
            <button className="btn btn-primary" style={{ minWidth: 250 }} onClick={() => navigate(`/unlock/${scan.id}`)} data-testid="unlock-report-button">
              Unlock the full report — {price}
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/scan/${scan.id}`)}>Add a better frame</button>
          </div>
        </div>
      </section>
    </>
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
    <>
      <header className="bar" style={{ borderBottom: "var(--rule-strong)" }}>
        <span className="label">RefCheck — report {specimenNo(scan.id)}</span>
        <span className="label muted">Issued {formatDate(scan.created_at)} · v1</span>
        <span style={{ display: "flex", gap: 18 }}>
          <button className="label accent" style={{ background: "none", border: "none", borderBottom: "1px solid var(--rust)", cursor: "pointer" }} onClick={() => window.print()}>Download PDF</button>
          <button className="label muted" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => window.print()}>Print</button>
        </span>
      </header>

      <section style={{ padding: "48px 40px 36px", borderBottom: "var(--rule-strong)" }}>
        <div style={{ display: "grid", gap: 40, alignItems: "end", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          <div>
            <div className="label label-kicker accent">Documented identification</div>
            <h1 className="h-screen" style={{ marginTop: 18, fontSize: 52, lineHeight: 1.04 }}>
              {brandName} {r.family}<br />{r.case_reference ? `Ref. ${r.case_reference}` : ""}
            </h1>
            <p className="mono-note" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7 }}>
              {[r.calibre && `Calibre ${r.calibre}`, r.serial_range && `Serial ${r.serial_range}`, r.estimated_period].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div>
            <div className="conf-head">
              <span className="label label-sm muted">Overall confidence</span>
              <span className="figure-lg" data-testid="confidence-value">{r.confidence_percentage}%</span>
            </div>
            <div className="conf-bar" style={{ height: 16 }}><i style={{ width: `${r.confidence_percentage}%` }} /></div>
            <p className="mono-note" style={{ marginTop: 12 }}>
              {summary.matched} attributes matched · {summary.unresolved} unresolved · {summary.contradicted} contradicted
            </p>
          </div>
        </div>
      </section>

      <div className="cols" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", borderBottom: "var(--rule-strong)" }}>
        {plates.map((p) => (
          <div key={p.slot}>
            <div className="photo photo-4x3">{photoUrl(p.slot) && <img src={photoUrl(p.slot)} alt="" />}</div>
            <p className="mono-note" style={{ padding: "14px 24px" }}>{p.caption}</p>
          </div>
        ))}
      </div>

      <section style={{ padding: "44px 40px 8px" }}>
        <div className="label label-kicker muted">Section 01 — Matched attributes</div>
      </section>
      <div className="table-wrap" style={{ padding: "20px 40px 0" }} data-testid="full-report">
        <table className="table">
          <thead>
            <tr>
              <th>Attribute</th><th>Finding</th><th>Source</th><th>Match</th>
            </tr>
          </thead>
          <tbody>
            {(r.matched_attributes || []).map((m, i) => {
              const unresolved = /unresolved|contradicted/i.test(m.match || "");
              const isLast = i === (r.matched_attributes || []).length - 1;
              return (
                <tr key={i} className={unresolved ? "unresolved" : ""} style={isLast ? { borderBottom: "var(--rule-strong)" } : undefined}>
                  <td>{m.attribute}</td>
                  <td>{m.finding}</td>
                  <td>{m.source}</td>
                  <td className="match">{m.match}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cols cols-3" style={{ marginTop: 44, borderTop: "var(--rule-strong)" }}>
        <div className="cell">
          <div className="label label-kicker muted">Section 02 — Reading</div>
          <p className="body" style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>{r.reading}</p>
        </div>
        <div className="cell">
          <div className="label label-kicker muted">Section 03 — Unresolved</div>
          <p className="body" style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>{r.unresolved_note || "Nothing significant is unresolved."}</p>
        </div>
        <div className="cell">
          <div className="label label-kicker muted">Section 04 — Scope</div>
          <p className="body" style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>
            An identification against verified {brandName} reference data, on the frames supplied. Not a valuation, and not an authentication certificate.
            Reference data as catalogued {new Date().toLocaleDateString(undefined, { month: "2-digit", year: "numeric" })}.
          </p>
        </div>
      </div>

      <div className="btn-row" style={{ padding: "36px 40px 48px", borderTop: "var(--rule-strong)" }}>
        <button className="btn btn-ink" style={{ minWidth: 220 }} onClick={() => window.print()}>Download the PDF</button>
        <a className="btn btn-outline" href="/scan">Identify another watch</a>
      </div>
    </>
  );
}
