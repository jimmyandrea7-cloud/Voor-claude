import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, X, Search } from "lucide-react";

const ink = (a) => `rgba(36,31,26,${a})`;

const EMPTY = {
  brand_id: "", model_family: "", reference_numbers: "", serial_range_start: "", serial_range_end: "",
  production_period: "", case_material: "", movement_caliber: "", dial_variants: "", notable_history: "", source_notes: "",
};

function EField({ label, k, full, ph, form, set }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>{label}</label>
      <input value={form[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} data-testid={`entry-field-${k}`} className="field" />
    </div>
  );
}

export default function Admin() {
  const [brands, setBrands] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [settings, setSettings] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (brandFilter) params.brand_id = brandFilter;
    if (search) params.search = search;
    const [e, b, st] = await Promise.all([
      api.get("/reference-entries", { params }),
      api.get("/brands"),
      api.get("/settings"),
    ]);
    setEntries(e.data); setBrands(b.data); setSettings(st.data); setLoading(false);
  }, [brandFilter, search]);

  useEffect(() => { load(); }, [load]);

  const brandName = (id) => brands.find((b) => b.id === id)?.name || "—";

  const del = async (id) => {
    if (!window.confirm("Delete this reference entry?")) return;
    await api.delete(`/reference-entries/${id}`);
    toast.success("Entry deleted");
    load();
  };

  return (
    <Layout>
      <div className="px-6 md:px-10 py-14">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-9">
          <div>
            <span className="eyebrow">Admin — internal only</span>
            <h1 className="mt-3 font-serif text-4xl" style={{ color: "#241F1A" }}>Reference database</h1>
            <p className="mt-2 text-[14px]" style={{ color: ink(0.7) }}>The documented knowledge behind every cross-check. Any brand can be added here.</p>
          </div>
          <button onClick={() => setEditing({ ...EMPTY, brand_id: brands[0]?.id || "" })} data-testid="add-entry-btn" className="btn">
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </button>
        </div>

        <PriceSettings settings={settings} onSaved={load} />

        <div className="flex flex-wrap gap-3 mb-5 mt-9">
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} data-testid="admin-brand-filter" className="select-field w-auto">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: ink(0.45) }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model, reference, calibre…" data-testid="admin-search" className="field pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" data-testid="reference-table">
              <thead>
                <tr className="text-left" style={{ borderTop: "2px solid #241F1A", borderBottom: "2px solid #241F1A" }}>
                  <th className="py-3 px-4 pl-0 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>Model family</th>
                  <th className="py-3 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>Brand</th>
                  <th className="py-3 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>References</th>
                  <th className="py-3 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>Serial range</th>
                  <th className="py-3 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>Period</th>
                  <th className="py-3 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: ink(0.6) }}>Calibre</th>
                  <th className="py-3 px-4 pr-0"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${ink(0.15)}` }} data-testid={`entry-row-${e.id}`}>
                    <td className="py-3.5 px-4 pl-0 font-medium" style={{ color: "#241F1A" }}>{e.model_family}</td>
                    <td className="py-3.5 px-4" style={{ color: ink(0.7) }}>{brandName(e.brand_id)}</td>
                    <td className="py-3.5 px-4" style={{ color: ink(0.7) }}>{(e.reference_numbers || []).join(", ") || "—"}</td>
                    <td className="py-3.5 px-4 font-mono text-[12px]" style={{ color: ink(0.7) }}>{e.serial_range_start || "?"}–{e.serial_range_end || "?"}</td>
                    <td className="py-3.5 px-4" style={{ color: ink(0.7) }}>{e.production_period || "—"}</td>
                    <td className="py-3.5 px-4" style={{ color: ink(0.7) }}>{e.movement_caliber || "—"}</td>
                    <td className="py-3.5 px-4 pr-0">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => setEditing({ ...e, reference_numbers: (e.reference_numbers || []).join(", ") })} data-testid={`edit-entry-${e.id}`} style={{ color: ink(0.6) }} className="hover:opacity-100" onMouseEnter={(ev) => ev.currentTarget.style.color = "#241F1A"} onMouseLeave={(ev) => ev.currentTarget.style.color = ink(0.6)}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(e.id)} data-testid={`delete-entry-${e.id}`} style={{ color: ink(0.6) }} onMouseEnter={(ev) => ev.currentTarget.style.color = "#B8420E"} onMouseLeave={(ev) => ev.currentTarget.style.color = ink(0.6)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center" style={{ color: ink(0.55) }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EntryModal entry={editing} brands={brands} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </Layout>
  );
}

function PriceSettings({ settings, onSaved }) {
  const [price, setPrice] = useState("");
  const [display, setDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings) { setPrice(settings.report_price_amount ?? ""); setDisplay(settings.report_price_display ?? ""); } }, [settings]);
  if (!settings) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { report_price_amount: parseFloat(price), report_price_display: display });
      toast.success("Pricing updated (display only — checkout price is set in Stripe).");
      onSaved();
    } catch { toast.error("Could not save settings."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ border: `1px solid ${ink(0.2)}`, padding: 24 }} data-testid="price-settings">
      <span className="eyebrow">Report pricing (display)</span>
      <div className="flex flex-wrap gap-6 items-end mt-4">
        <div>
          <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>Display label</label>
          <input value={display} onChange={(e) => setDisplay(e.target.value)} data-testid="settings-price-display" className="field w-32" />
        </div>
        <div>
          <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>Amount (EUR)</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="settings-price-amount" className="field w-28" />
        </div>
        <button onClick={save} disabled={saving} data-testid="save-settings-btn" className="btn btn-sm">{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function EntryModal({ entry, brands, onClose, onSaved }) {
  const [form, setForm] = useState(entry);
  const [saving, setSaving] = useState(false);
  const isEdit = !!entry.id;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.model_family || !form.brand_id) { toast.error("Brand and model family are required."); return; }
    setSaving(true);
    const payload = { ...form, reference_numbers: (form.reference_numbers || "").split(",").map((s) => s.trim()).filter(Boolean) };
    delete payload.id; delete payload.created_at;
    try {
      if (isEdit) await api.put(`/reference-entries/${entry.id}`, payload);
      else await api.post("/reference-entries", payload);
      toast.success(isEdit ? "Entry updated" : "Entry added");
      onSaved();
    } catch { toast.error("Save failed."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(36,31,26,.5)" }} onClick={onClose}>
      <div style={{ background: "#F3EEE3", border: "2px solid #241F1A" }} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="entry-modal">
        <div className="flex items-center justify-between p-5 sticky top-0" style={{ background: "#F3EEE3", borderBottom: "2px solid #241F1A" }}>
          <h3 className="font-serif text-2xl" style={{ color: "#241F1A" }}>{isEdit ? "Edit" : "Add"} reference entry</h3>
          <button onClick={onClose} data-testid="close-modal-btn" style={{ color: ink(0.6) }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>Brand *</label>
            <select value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)} data-testid="entry-field-brand_id" className="select-field">
              <option value="">Select brand</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <EField form={form} set={set} label="Model family *" k="model_family" ph="Speedmaster Professional" />
          <EField form={form} set={set} label="Reference numbers (comma-separated)" k="reference_numbers" full ph="145.022, ST 145.022" />
          <EField form={form} set={set} label="Serial range start" k="serial_range_start" ph="24000000" />
          <EField form={form} set={set} label="Serial range end" k="serial_range_end" ph="30000000" />
          <EField form={form} set={set} label="Production period" k="production_period" ph="1963-1970" />
          <EField form={form} set={set} label="Case material" k="case_material" ph="Stainless steel" />
          <EField form={form} set={set} label="Movement / calibre" k="movement_caliber" ph="Cal. 321 / 861" />
          <EField form={form} set={set} label="Dial variants" k="dial_variants" ph="Stepped dial, applied logo" />
          <div className="sm:col-span-2">
            <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>Notable history / fun facts</label>
            <textarea value={form.notable_history || ""} onChange={(e) => set("notable_history", e.target.value)} rows={2} data-testid="entry-field-notable_history" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-mono text-[10px] mb-2 uppercase tracking-[0.1em]" style={{ color: ink(0.55) }}>Source / citation notes</label>
            <input value={form.source_notes || ""} onChange={(e) => set("source_notes", e.target.value)} data-testid="entry-field-source_notes" className="field" />
          </div>
        </div>
        <div className="p-5 flex justify-end gap-3 sticky bottom-0" style={{ background: "#F3EEE3", borderTop: "2px solid #241F1A" }}>
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={submit} disabled={saving} data-testid="save-entry-btn" className="btn">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {isEdit ? "Save changes" : "Add entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
