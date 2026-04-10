import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, Search, ToggleLeft, ToggleRight, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CustomField {
  key: string;
  label: string;
  type: "text" | "email" | "tel";
  required: boolean;
}

interface WithdrawMethod {
  id: string;
  name: string;
  logo_url: string | null;
  min_amount: number;
  max_amount: number;
  custom_fields: CustomField[];
  is_active: boolean;
}

const AdminWithdrawMethods = () => {
  const [methods, setMethods] = useState<WithdrawMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal
  const [modal, setModal] = useState<{ mode: "add" | "edit"; method?: WithdrawMethod } | null>(null);
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("20");
  const [maxAmount, setMaxAmount] = useState("10000");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Daily limit
  const [dailyLimit, setDailyLimit] = useState("100");
  const [savingLimit, setSavingLimit] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);

  const fetchMethods = async () => {
    setLoading(true);
    const { data } = await supabase.from("withdraw_methods").select("*").order("name");
    if (data) setMethods(data.map(d => ({ ...d, custom_fields: (d.custom_fields || []) as unknown as CustomField[] })));
    setLoading(false);
  };

  const fetchDailyLimit = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "daily_withdraw_limit").maybeSingle();
    if (data) setDailyLimit(data.value);
  };

  useEffect(() => { fetchMethods(); fetchDailyLimit(); }, []);

  const openAdd = () => {
    setName(""); setMinAmount("20"); setMaxAmount("10000"); setLogoFile(null); setLogoPreview(""); setLogoUrl("");
    setCustomFields([]);
    setModal({ mode: "add" });
  };

  const openEdit = (m: WithdrawMethod) => {
    setName(m.name); setMinAmount(String(m.min_amount)); setMaxAmount(String(m.max_amount));
    setLogoFile(null); setLogoPreview(m.logo_url || ""); setLogoUrl(m.logo_url || "");
    setCustomFields(m.custom_fields || []);
    setModal({ mode: "edit", method: m });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `withdraw-logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const addField = () => {
    setCustomFields([...customFields, { key: `field_${Date.now()}`, label: "", type: "text", required: true }]);
  };

  const updateField = (idx: number, updates: Partial<CustomField>) => {
    setCustomFields(customFields.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeField = (idx: number) => {
    setCustomFields(customFields.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (customFields.some(f => !f.label.trim())) { toast({ title: "All field labels are required", variant: "destructive" }); return; }
    
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) finalLogoUrl = await uploadLogo(logoFile);

      // Auto-generate keys from labels
      const fieldsWithKeys = customFields.map(f => ({
        ...f,
        key: f.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'),
      }));

      const payload = {
        name: name.trim(),
        logo_url: finalLogoUrl || null,
        min_amount: parseFloat(minAmount) || 20,
        max_amount: parseFloat(maxAmount) || 10000,
        custom_fields: fieldsWithKeys as any,
      };

      if (modal?.mode === "edit" && modal.method) {
        const { error } = await supabase.from("withdraw_methods").update(payload).eq("id", modal.method.id);
        if (error) throw error;
        toast({ title: "Method updated" });
      } else {
        const { error } = await supabase.from("withdraw_methods").insert(payload);
        if (error) throw error;
        toast({ title: "Method added" });
      }
      setModal(null);
      fetchMethods();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: WithdrawMethod) => {
    await supabase.from("withdraw_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    fetchMethods();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("withdraw_methods").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchMethods();
    toast({ title: "Method deleted" });
  };

  const saveDailyLimit = async () => {
    setSavingLimit(true);
    const { error } = await supabase.from("app_settings").update({ value: dailyLimit }).eq("key", "daily_withdraw_limit");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Daily limit updated" });
    setSavingLimit(false);
  };

  const filtered = methods.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Withdraw Methods</h1>
          <p className="text-sm text-muted-foreground">Manage withdrawal payment methods and daily limits</p>
        </div>
        <Button onClick={openAdd} className="gradient-bg text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Add Method
        </Button>
      </div>

      {/* Daily Withdraw Limit */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Daily Withdraw Limit (per user, 24hrs)</h3>
        <p className="text-xs text-muted-foreground mb-3">Max total amount a user can withdraw within 24 hours (sum of all pending + completed requests)</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              value={dailyLimit}
              onChange={e => setDailyLimit(e.target.value)}
              className="w-32 rounded-lg border border-border bg-muted/50 pl-7 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <Button size="sm" onClick={saveDailyLimit} disabled={savingLimit}>
            {savingLimit ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search methods..."
          className="w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No withdraw methods found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Fields</th>
                <th className="px-4 py-3 font-medium">Min</th>
                <th className="px-4 py-3 font-medium">Max</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.logo_url ? (
                        <img src={m.logo_url} alt={m.name} className="h-10 w-10 rounded-lg object-contain bg-muted/50 p-1 border border-border" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(m.custom_fields || []).map((f, i) => (
                        <span key={i} className="inline-block rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{f.label}</span>
                      ))}
                      {(!m.custom_fields || m.custom_fields.length === 0) && <span className="text-xs text-muted-foreground/50">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">${m.min_amount}</td>
                  <td className="px-4 py-3 text-foreground">${m.max_amount}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(m)} className="flex items-center gap-1.5">
                      {m.is_active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      <span className={`text-xs ${m.is_active ? "text-green-500" : "text-muted-foreground"}`}>{m.is_active ? "Active" : "Inactive"}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(m.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.mode === "edit" ? "Edit" : "Add"} Withdraw Method</DialogTitle>
            <DialogDescription>Configure the method name, logo, limits, and customer fields</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PayPal"
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            {/* Logo */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Logo</label>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="logo" className="h-14 w-14 rounded-lg object-contain border border-border bg-muted/50 p-1" />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(""); setLogoUrl(""); }}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => logoRef.current?.click()}
                    className="h-14 w-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}
                {!logoPreview && (
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                    <ImageIcon className="h-3 w-3 mr-1" /> Upload Logo
                  </Button>
                )}
              </div>
            </div>

            {/* Min/Max */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Amount ($)</label>
                <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Max Amount ($)</label>
                <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            </div>

            {/* Custom Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">Customer Fields</label>
                <Button variant="outline" size="sm" onClick={addField}><Plus className="h-3 w-3 mr-1" /> Add Field</Button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">Fields the customer must fill when withdrawing (e.g. Email, Phone, Zelle Name)</p>
              {customFields.length === 0 && (
                <p className="text-xs text-muted-foreground/50 py-2 text-center border border-dashed border-border rounded-lg">No fields added yet</p>
              )}
              <div className="space-y-2">
                {customFields.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                    <input
                      value={f.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder="Field label (e.g. Email)"
                      className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                    />
                    <select
                      value={f.type}
                      onChange={e => updateField(idx, { type: e.target.value as CustomField["type"] })}
                      className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                      <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                      Req
                    </label>
                    <button onClick={() => removeField(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gradient-bg text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {modal?.mode === "edit" ? "Update Method" : "Add Method"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Method</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawMethods;
