import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, X, Search } from "lucide-react";

const EMPTY = {
  brand_id: "", model_family: "", reference_numbers: "", serial_range_start: "", serial_range_end: "",
  production_period: "", case_material: "", movement_caliber: "", dial_variants: "", notable_history: "", source_notes: "",
};

function EField({ label, k, full, ph, form, set }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">{label}</label>
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
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <span className="eyebrow">Admin</span>
            <h1 className="mt-3 font-serif text-4xl text-[#241F1A]">Reference database</h1>
            <p className="mt-2 text-[14px] text-[#6B5F4F]">The documented knowledge behind every cross-check. Any brand can be added here.</p>
          </div>
          <button onClick={() => setEditing({ ...EMPTY, brand_id: brands[0]?.id || "" })} data-testid="add-entry-btn" className="btn">
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </button>
        </div>

        <PriceSettings settings={settings} onSaved={load} />

        <div className="flex flex-wrap gap-3 mb-4 mt-8">
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} data-testid="admin-brand-filter" className="field w-auto">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-[#746A56] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model, reference, calibre…" data-testid="admin-search" className="field pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#241F1A] animate-spin" /></div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" data-testid="reference-table">
                <thead>
                  <tr className="text-left text-[#6B5F4F] border-b border-[#E2D9C6] text-[10px] uppercase tracking-[0.14em]">
                    <th className="p-4 font-medium">Model family</th>
                    <th className="p-4 font-medium">Brand</th>
                    <th className="p-4 font-medium">References</th>
                    <th className="p-4 font-medium">Serial range</th>
                    <th className="p-4 font-medium">Period</th>
                    <th className="p-4 font-medium">Calibre</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-[#E2D9C6] last:border-b-0 hover:bg-[#FBF3E2]" data-testid={`entry-row-${e.id}`}>
                      <td className="p-4 text-[#241F1A] font-medium">{e.model_family}</td>
                      <td className="p-4 text-[#6B5F4F]">{brandName(e.brand_id)}</td>
                      <td className="p-4 text-[#6B5F4F]">{(e.reference_numbers || []).join(", ") || "—"}</td>
                      <td className="p-4 text-[#6B5F4F]">{e.serial_range_start || "?"}–{e.serial_range_end || "?"}</td>
                      <td className="p-4 text-[#6B5F4F]">{e.production_period || "—"}</td>
                      <td className="p-4 text-[#6B5F4F]">{e.movement_caliber || "—"}</td>
                      <td className="p-4">
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => setEditing({ ...e, reference_numbers: (e.reference_numbers || []).join(", ") })} data-testid={`edit-entry-${e.id}`} className="text-[#6B5F4F] hover:text-[#241F1A]"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => del(e.id)} data-testid={`delete-entry-${e.id}`} className="text-[#6B5F4F] hover:text-[#241F1A]"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-[#746A56]">No entries found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
    <div className="card p-6" data-testid="price-settings">
      <span className="eyebrow">Report pricing (display)</span>
      <div className="flex flex-wrap gap-3 items-end mt-4">
        <div><label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">Display label</label><input value={display} onChange={(e) => setDisplay(e.target.value)} data-testid="settings-price-display" className="field w-32" /></div>
        <div><label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">Amount (USD)</label><input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="settings-price-amount" className="field w-28" /></div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#241F1A]/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#FFFCF5] border border-[#E2D9C6] w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="entry-modal">
        <div className="flex items-center justify-between p-5 border-b border-[#E2D9C6] sticky top-0 bg-[#FFFCF5]">
          <h3 className="font-serif text-2xl text-[#241F1A]">{isEdit ? "Edit" : "Add"} reference entry</h3>
          <button onClick={onClose} data-testid="close-modal-btn" className="text-[#6B5F4F] hover:text-[#241F1A]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">Brand *</label>
            <select value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)} data-testid="entry-field-brand_id" className="field">
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
            <label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">Notable history / fun facts</label>
            <textarea value={form.notable_history || ""} onChange={(e) => set("notable_history", e.target.value)} rows={2} data-testid="entry-field-notable_history" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-[#6B5F4F] mb-1.5 uppercase tracking-[0.1em]">Source / citation notes</label>
            <input value={form.source_notes || ""} onChange={(e) => set("source_notes", e.target.value)} data-testid="entry-field-source_notes" className="field" />
          </div>
        </div>
        <div className="p-5 border-t border-[#E2D9C6] flex justify-end gap-3 sticky bottom-0 bg-[#FFFCF5]">
          <button onClick={onClose} className="btn btn-outline">Cancel</button>
          <button onClick={submit} disabled={saving} data-testid="save-entry-btn" className="btn">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {isEdit ? "Save changes" : "Add entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
