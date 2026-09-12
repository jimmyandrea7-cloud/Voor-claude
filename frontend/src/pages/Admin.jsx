import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import Layout from "../components/Layout";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, X, Database, Search, Settings } from "lucide-react";

const EMPTY = {
  brand_id: "", model_family: "", reference_numbers: "", serial_range_start: "", serial_range_end: "",
  production_period: "", case_material: "", movement_caliber: "", dial_variants: "", notable_history: "", source_notes: "",
};

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
      <div className="max-w-6xl mx-auto px-5 py-12">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80 inline-flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Admin</span>
            <h1 className="mt-2 font-serif text-4xl text-slate-100">Reference Database</h1>
            <p className="mt-1 text-slate-400">Curate the knowledge that powers cross-referencing. Add any brand's data here.</p>
          </div>
          <button onClick={() => setEditing({ ...EMPTY, brand_id: brands[0]?.id || "" })} data-testid="add-entry-btn" className="rc-gold-btn px-5 py-3 rounded-full font-semibold inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>

        <PriceSettings settings={settings} onSaved={load} />

        <div className="flex flex-wrap gap-3 mb-4 mt-8">
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} data-testid="admin-brand-filter" className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-slate-200">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model, reference, caliber…" data-testid="admin-search" className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#D4AF37]/50" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin" /></div>
        ) : (
          <div className="rc-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="reference-table">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-[#1E293B] text-xs uppercase tracking-wider font-mono">
                    <th className="p-4">Model family</th>
                    <th className="p-4">Brand</th>
                    <th className="p-4">References</th>
                    <th className="p-4">Serial range</th>
                    <th className="p-4">Period</th>
                    <th className="p-4">Caliber</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-[#1E293B]/60 hover:bg-[#0F172A]/50" data-testid={`entry-row-${e.id}`}>
                      <td className="p-4 text-slate-100 font-medium">{e.model_family}</td>
                      <td className="p-4 text-slate-400">{brandName(e.brand_id)}</td>
                      <td className="p-4 text-slate-400 font-mono text-xs">{(e.reference_numbers || []).join(", ") || "—"}</td>
                      <td className="p-4 text-slate-400 font-mono text-xs">{e.serial_range_start || "?"}–{e.serial_range_end || "?"}</td>
                      <td className="p-4 text-slate-400">{e.production_period || "—"}</td>
                      <td className="p-4 text-slate-400">{e.movement_caliber || "—"}</td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing({ ...e, reference_numbers: (e.reference_numbers || []).join(", ") })} data-testid={`edit-entry-${e.id}`} className="text-slate-400 hover:text-[#D4AF37]"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => del(e.id)} data-testid={`delete-entry-${e.id}`} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No entries found.</td></tr>
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
    <div className="rc-card rounded-2xl p-6" data-testid="price-settings">
      <div className="flex items-center gap-2 mb-4"><Settings className="w-4 h-4 text-[#38BDF8]" /><h3 className="text-slate-100 font-medium">Report pricing (display)</h3></div>
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs text-slate-500 mb-1">Display label</label><input value={display} onChange={(e) => setDisplay(e.target.value)} data-testid="settings-price-display" className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200 w-32" /></div>
        <div><label className="block text-xs text-slate-500 mb-1">Amount (USD)</label><input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="settings-price-amount" className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200 w-28" /></div>
        <button onClick={save} disabled={saving} data-testid="save-settings-btn" className="rc-gold-btn px-5 py-2 rounded-full text-sm font-semibold">{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function EField({ label, k, full, ph, form, set }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input value={form[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} data-testid={`entry-field-${k}`} className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#D4AF37]/50" />
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="entry-modal">
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B] sticky top-0 bg-[#111827]">
          <h3 className="font-serif text-2xl text-slate-100">{isEdit ? "Edit" : "Add"} reference entry</h3>
          <button onClick={onClose} data-testid="close-modal-btn" className="text-slate-400 hover:text-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Brand *</label>
            <select value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)} data-testid="entry-field-brand_id" className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200">
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
          <EField form={form} set={set} label="Movement / caliber" k="movement_caliber" ph="Cal. 321 / 861" />
          <EField form={form} set={set} label="Dial variants" k="dial_variants" ph="Stepped dial, applied logo" />
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notable history / fun facts</label>
            <textarea value={form.notable_history || ""} onChange={(e) => set("notable_history", e.target.value)} rows={2} data-testid="entry-field-notable_history" className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#D4AF37]/50" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Source / citation notes</label>
            <input value={form.source_notes || ""} onChange={(e) => set("source_notes", e.target.value)} data-testid="entry-field-source_notes" className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#D4AF37]/50" />
          </div>
        </div>
        <div className="p-5 border-t border-[#1E293B] flex justify-end gap-3 sticky bottom-0 bg-[#111827]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-[#1E293B] text-slate-300 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} data-testid="save-entry-btn" className="rc-gold-btn px-6 py-2.5 rounded-full font-semibold text-sm inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? "Save changes" : "Add entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
