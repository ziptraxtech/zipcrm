import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, Phone, MapPin, Building2, Plus, MessageCircle } from "lucide-react";
import CreateTaskDialog from "../components/CreateTaskDialog";
import { LEAD_STATUSES, statusColors, useCrmApi, errorMessage } from "../components/crm/crm";
import { StatusBadge, SourceBadge } from "../components/crm/leadUi";

// raw EVChamp columns that are internal plumbing rather than useful lead info
const HIDDEN_FIELDS = ["id", "clerk_user_id", "email_sent"];

const humanize = (key) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const LeadDetails = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const source = searchParams.get("source");
    const sourceId = searchParams.get("id");
    const { request, workspaceId } = useCrmApi();
    const members = useSelector((state) => state?.workspace?.currentWorkspace?.members || []);

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [value, setValue] = useState("");
    const [showCreateTask, setShowCreateTask] = useState(false);

    const basePath = `/api/leads/${source}/${sourceId}`;

    useEffect(() => {
        if (!workspaceId || !source || !sourceId) return;
        let ignore = false;
        setLoading(true);
        request("get", basePath)
            .then((res) => { if (!ignore) { setDetail(res); setValue(res.lead.value ?? "") } })
            .catch((error) => { if (!ignore) toast.error(errorMessage(error)) })
            .finally(() => { if (!ignore) setLoading(false) });
        return () => { ignore = true };
    }, [request, workspaceId, source, sourceId, basePath]);

    const update = async (changes) => {
        try {
            const { leadState } = await request("patch", basePath, { body: changes });
            const owner = members.find((m) => m.user.id === leadState.ownerId)?.user;
            setDetail((d) => ({ ...d, lead: { ...d.lead, status: leadState.status, owner_id: leadState.ownerId, owner_name: owner?.name, value: leadState.value, lead_state_id: leadState.id } }));
            return leadState;
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const saveValue = () => {
        const rupees = value === "" ? null : Math.round(Number(value));
        if (rupees === (detail.lead.value ?? null)) return;
        if (rupees !== null && (!Number.isFinite(rupees) || rupees < 0)) return toast.error("Enter a valid amount");
        update({ value: rupees }).then((s) => s && toast.success("Deal value saved"));
    };

    const addNote = async () => {
        if (!note.trim()) return;
        try {
            const { note: created, leadStateId } = await request("post", `${basePath}/notes`, { body: { content: note } });
            setDetail((d) => ({ ...d, notes: [created, ...d.notes], lead: { ...d.lead, lead_state_id: leadStateId } }));
            setNote("");
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    // a task needs a LeadState row to link to; touching the lead creates it
    const openCreateTask = async () => {
        if (!detail.lead.lead_state_id && !await update({})) return;
        setShowCreateTask(true);
    };

    if (loading) return <div className="p-6 text-center text-sm text-gray-500 dark:text-zinc-400">Loading lead...</div>;
    if (!detail) return <div className="p-6 text-center text-red-500">Lead not found</div>;

    const { lead, raw, notes, tasks, related } = detail;
    const cardClasses = "rounded-lg border border-gray-300 dark:border-zinc-800 p-5 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50";

    return (
        <div className="max-w-6xl mx-auto space-y-6 text-gray-900 dark:text-zinc-100">
            <button onClick={() => navigate("/leads")} className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="size-4" /> Back to leads
            </button>

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-semibold">{lead.name || lead.email}</h1>
                        <SourceBadge source={lead.source} />
                        {lead.source_status && <span className="text-xs text-gray-500 dark:text-zinc-400">EVChamp status: {lead.source_status}</span>}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-zinc-300">
                        {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-blue-500"><Mail className="size-4" />{lead.email}</a>}
                        {lead.phone && <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-blue-500"><Phone className="size-4" />{lead.phone}</a>}
                        {lead.city && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{lead.city}</span>}
                        {lead.company && <span className="flex items-center gap-1.5"><Building2 className="size-4" />{lead.company}</span>}
                    </div>
                </div>

                {/* CRM controls */}
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-gray-500 dark:text-zinc-400 space-y-1">
                        <span className="block">Status</span>
                        <select value={lead.status} onChange={(e) => update({ status: e.target.value })} className={`text-sm rounded-md px-2 py-1.5 border-0 ${statusColors[lead.status]}`}>
                            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label className="text-xs text-gray-500 dark:text-zinc-400 space-y-1">
                        <span className="block">Owner</span>
                        <select value={lead.owner_id || ""} onChange={(e) => update({ ownerId: e.target.value || null })} className="text-sm rounded-md px-2 py-1.5 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 text-gray-900 dark:text-white">
                            <option value="">Unassigned</option>
                            {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs text-gray-500 dark:text-zinc-400 space-y-1">
                        <span className="block">Deal value (₹)</span>
                        <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} onBlur={saveValue} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="—" className="w-32 text-sm rounded-md px-2 py-1.5 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 text-gray-900 dark:text-white" />
                    </label>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Submission */}
                    <div className={cardClasses}>
                        <h2 className="font-semibold mb-3">Submission</h2>
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            {Object.entries(raw || {}).filter(([k, v]) => !HIDDEN_FIELDS.includes(k) && v !== null && v !== "").map(([k, v]) => (
                                <div key={k} className={k === "message" || k === "description" ? "sm:col-span-2" : ""}>
                                    <dt className="text-xs text-gray-500 dark:text-zinc-400">{humanize(k)}</dt>
                                    <dd className="whitespace-pre-wrap break-words">
                                        {k.endsWith("_at") ? format(new Date(v), "dd MMM yyyy, HH:mm") : String(v)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* Notes */}
                    <div className={cardClasses}>
                        <h2 className="font-semibold mb-3 flex items-center gap-2"><MessageCircle className="size-4" /> Notes ({notes.length})</h2>
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, meeting or next step..." className="flex-1 text-sm rounded-md p-2 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 resize-none focus:outline-none focus:ring-1 focus:ring-blue-600" rows={2} />
                            <button onClick={addNote} className="self-end bg-gradient-to-l from-blue-500 to-blue-600 transition-colors text-white text-sm px-5 py-2 rounded">Add note</button>
                        </div>
                        <div className="space-y-3">
                            {notes.map((n) => (
                                <div key={n.id} className="p-3 rounded-md bg-gray-50 dark:bg-zinc-800/60 text-sm">
                                    <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 dark:text-zinc-400">
                                        {n.user?.image && <img src={n.user.image} alt="" className="size-5 rounded-full" />}
                                        <span className="font-medium text-gray-900 dark:text-white">{n.user?.name}</span>
                                        • {format(new Date(n.createdAt), "dd MMM yyyy, HH:mm")}
                                    </div>
                                    <p className="whitespace-pre-wrap">{n.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Tasks */}
                    <div className={cardClasses}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold">Follow-up tasks</h2>
                            <button onClick={openCreateTask} className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"><Plus className="size-4" /> Task</button>
                        </div>
                        {tasks.length === 0 ? <p className="text-sm text-gray-500 dark:text-zinc-400">No tasks yet</p> : (
                            <div className="space-y-2">
                                {tasks.map((t) => (
                                    <button key={t.id} onClick={() => navigate(`/taskDetails?projectId=${t.projectId}&taskId=${t.id}`)} className="w-full text-left p-2 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-sm">
                                        <p className="font-medium">{t.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">{t.project?.name} · {t.status.replace("_", " ")} · due {format(new Date(t.due_date), "dd MMM")}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Same person, other enquiries */}
                    <div className={cardClasses}>
                        <h2 className="font-semibold mb-3">Other enquiries from {lead.email || "this contact"}</h2>
                        {related.length === 0 ? <p className="text-sm text-gray-500 dark:text-zinc-400">None</p> : (
                            <div className="space-y-2">
                                {related.map((r) => (
                                    <button key={`${r.source}:${r.source_id}`} onClick={() => navigate(`/leadDetails?source=${r.source}&id=${r.source_id}`)} className="w-full text-left p-2 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-sm space-y-1">
                                        <div className="flex items-center gap-2"><SourceBadge source={r.source} /><StatusBadge status={r.status} /></div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{r.summary}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showCreateTask && (
                <CreateTaskDialog showCreateTask={showCreateTask} setShowCreateTask={setShowCreateTask}
                    leadStateId={lead.lead_state_id} defaultTitle={`Follow up: ${lead.name || lead.email}`}
                    onCreated={(task) => setDetail((d) => ({ ...d, tasks: [...d.tasks, task] }))} />
            )}
        </div>
    );
};

export default LeadDetails;
