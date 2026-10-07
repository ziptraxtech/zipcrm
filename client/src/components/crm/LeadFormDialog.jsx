import { useState } from "react";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { UserPlus, X } from "lucide-react";
import { LEAD_CHANNELS, LEAD_STATUSES, useCrmApi, errorMessage } from "./crm";

const EMPTY = { name: "", phone: "", email: "", city: "", company: "", notes: "", channel: "" };

// Add a lead by hand, or edit one that was added by hand (pass `lead` to edit).
// Any workspace member can add; the server lets the creator or an admin edit.
export default function LeadFormDialog({ lead, onClose, onSaved }) {
    const isEdit = Boolean(lead);
    const { request } = useCrmApi();
    const { user } = useUser();
    const members = useSelector((state) => state?.workspace?.currentWorkspace?.members || []);

    const [form, setForm] = useState(() => isEdit
        ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, lead[k] ?? ""]))
        : { ...EMPTY, status: "NEW", ownerId: user?.id || "" });
    const [saving, setSaving] = useState(false);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        if (!form.channel) return toast.error("Choose where the lead came from");
        if (!form.phone.trim() && !form.email.trim()) return toast.error("Add a phone number or an email");
        setSaving(true);
        try {
            const result = isEdit
                ? await request("put", `/api/leads/manual/${lead.id}`, { body: form })
                : await request("post", "/api/leads", { body: { ...form, ownerId: form.ownerId || null } });
            toast.success(result.message);
            onSaved(result);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const input = "w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const label = "text-sm font-medium";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur p-4">
            <form onSubmit={submit} className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4 text-zinc-900 dark:text-white">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2"><UserPlus className="size-5" /> {isEdit ? "Edit lead" : "Add lead"}</h2>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="size-5" /></button>
                </div>

                {/* Source channel */}
                <div className="space-y-2">
                    <p className={label}>Source <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {LEAD_CHANNELS.map((c) => {
                            const Icon = c.icon;
                            const selected = form.channel === c.key;
                            return (
                                <button type="button" key={c.key} onClick={() => setForm({ ...form, channel: c.key })}
                                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border text-xs transition ${selected ? `${c.color} ring-2 ring-blue-500` : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                                    <Icon className="size-3.5" /> {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className={label}>Name <span className="text-red-500">*</span></label>
                    <input value={form.name} onChange={set("name")} placeholder="Full name or business name" className={input} required />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className={label}>Phone / WhatsApp</label>
                        <input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" className={input} inputMode="tel" />
                    </div>
                    <div className="space-y-1">
                        <label className={label}>Email</label>
                        <input type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" className={input} />
                    </div>
                    <div className="space-y-1">
                        <label className={label}>City</label>
                        <input value={form.city} onChange={set("city")} placeholder="Pune" className={input} />
                    </div>
                    <div className="space-y-1">
                        <label className={label}>Company</label>
                        <input value={form.company} onChange={set("company")} placeholder="Optional" className={input} />
                    </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-2">A phone number or an email is required.</p>

                <div className="space-y-1">
                    <label className={label}>Requirement / notes</label>
                    <textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="What are they looking for? e.g. Wants a franchise in Baner, budget ₹20L" className={`${input} resize-none`} />
                </div>

                {!isEdit && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={label}>Status</label>
                            <select value={form.status} onChange={set("status")} className={input}>
                                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={label}>Owner</label>
                            <select value={form.ownerId} onChange={set("ownerId")} className={input}>
                                <option value="">Unassigned</option>
                                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.id === user?.id ? `${m.user.name} (me)` : m.user.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className="rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
                    <button type="submit" disabled={saving} className="rounded px-5 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-50">
                        {saving ? "Saving..." : isEdit ? "Save changes" : "Add lead"}
                    </button>
                </div>
            </form>
        </div>
    );
}
