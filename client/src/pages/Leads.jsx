import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Inbox, Search, LayoutList, Columns3, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { LEAD_CHANNELS, LEAD_STATUSES, statusColors, useCrmApi, errorMessage } from "../components/crm/crm";
import LeadFormDialog from "../components/crm/LeadFormDialog";
import { SourceBadge } from "../components/crm/leadUi";

const PAGE_SIZE = 25;
const BOARD_SIZE = 100;

const Leads = () => {
    const navigate = useNavigate();
    const { request, workspaceId } = useCrmApi();
    const members = useSelector((state) => state?.workspace?.currentWorkspace?.members || []);

    const [view, setView] = useState("table");
    const [source, setSource] = useState("");
    const [status, setStatus] = useState("");
    const [channel, setChannel] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [from, setFrom] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ leads: [], total: 0, countsBySource: {}, countsByStatus: {}, sources: [] });
    const [loading, setLoading] = useState(true);
    const [draggedLead, setDraggedLead] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // back to page 1 whenever the filters change
    useEffect(() => { setPage(1) }, [source, status, channel, debouncedSearch, from, view]);

    useEffect(() => {
        if (!workspaceId) return;
        let ignore = false;
        setLoading(true);
        const limit = view === "board" ? BOARD_SIZE : PAGE_SIZE;
        request("get", "/api/leads", {
            params: {
                source: source || undefined,
                status: view === "board" ? undefined : status || undefined,
                q: debouncedSearch || undefined,
                channel: channel || undefined,
                from: from ? new Date(from).toISOString() : undefined,
                page, limit,
            }
        })
            .then((res) => { if (!ignore) setData(res) })
            .catch((error) => { if (!ignore) toast.error(errorMessage(error)) })
            .finally(() => { if (!ignore) setLoading(false) });
        return () => { ignore = true };
    }, [request, workspaceId, source, status, channel, debouncedSearch, from, page, view, reloadKey]);

    const leadKey = (lead) => `${lead.source}:${lead.source_id}`;

    const updateLead = async (lead, changes) => {
        const previous = data;
        const owner = members.find((m) => m.user.id === changes.ownerId)?.user;
        // optimistic: show the change immediately, roll back if the server refuses
        setData({
            ...data,
            leads: data.leads.map((l) => leadKey(l) === leadKey(lead)
                ? { ...l, ...changes, ...(changes.ownerId !== undefined && { owner_id: changes.ownerId, owner_name: owner?.name }) }
                : l),
        });
        try {
            await request("patch", `/api/leads/${lead.source}/${lead.source_id}`, { body: changes });
        } catch (error) {
            setData(previous);
            toast.error(errorMessage(error));
        }
    };

    const openLead = (lead) => navigate(`/leadDetails?source=${lead.source}&id=${lead.source_id}`);
    const totalAllSources = Object.values(data.countsBySource).reduce((a, b) => a + b, 0);
    const pageCount = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">Leads</h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">Enquiries from the EVChamp website and app, plus leads your team adds from Instagram, WhatsApp and more</p>
                </div>
                <div className="flex items-center gap-3">
                <div className="flex rounded border border-gray-300 dark:border-zinc-700 overflow-hidden text-sm">
                    {[["table", LayoutList, "Table"], ["board", Columns3, "Board"]].map(([key, icon, label]) => {
                        const Icon = icon;
                        return (
                            <button key={key} onClick={() => setView(key)} className={`flex items-center gap-2 px-3 py-1.5 ${view === key ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/60"}`}>
                                <Icon className="size-4" /> {label}
                            </button>
                        );
                    })}
                </div>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-1.5 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white">
                    <Plus className="size-4" /> Add Lead
                </button>
                </div>
            </div>

            {showAdd && (
                <LeadFormDialog onClose={() => setShowAdd(false)}
                    onSaved={({ sourceId }) => { setShowAdd(false); setReloadKey((k) => k + 1); navigate(`/leadDetails?source=manual&id=${sourceId}`) }} />
            )}

            {/* Source tabs */}
            <div className="flex flex-wrap gap-2">
                {[{ key: "", label: "All" }, ...data.sources].map((s) => (
                    <button key={s.key || "all"} onClick={() => setSource(s.key)} className={`px-3 py-1.5 rounded-full text-xs border transition ${source === s.key ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60"}`}>
                        {s.label} <span className="opacity-70">{s.key ? data.countsBySource[s.key] || 0 : totalAllSources}</span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3" />
                    <input placeholder="Search name, email, phone, company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full text-sm rounded-md border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 py-2 focus:outline-none focus:border-blue-500" />
                </div>
                {view === "table" && (
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm rounded-md border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white py-2 px-3">
                        <option value="">All statuses</option>
                        {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s} ({data.countsByStatus[s] || 0})</option>)}
                    </select>
                )}
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className="text-sm rounded-md border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white py-2 px-3">
                    <option value="">All channels</option>
                    {LEAD_CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                    Since
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm rounded-md border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white py-1.5 px-2" />
                </label>
            </div>

            {loading && data.leads.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-500 dark:text-zinc-400">Loading leads...</div>
            ) : data.leads.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <Inbox className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No leads found</h3>
                    <p className="text-gray-500 dark:text-zinc-400">Try adjusting the filters</p>
                </div>
            ) : view === "table" ? (
                <>
                    <div className={`overflow-x-auto rounded-md border border-gray-200 dark:border-zinc-800 transition-opacity ${loading ? "opacity-60" : ""}`}>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-900/50">
                                <tr>
                                    {["Lead", "Source", "Details", "Status", "Owner", "Received"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {data.leads.map((lead) => (
                                    <tr key={leadKey(lead)} onClick={() => openLead(lead)} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                                        <td className="px-4 py-2.5">
                                            <p className="text-zinc-900 dark:text-white font-medium">{lead.name || "—"}</p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400">{[lead.email, lead.phone].filter(Boolean).join(" · ")}</p>
                                        </td>
                                        <td className="px-4 py-2.5"><SourceBadge source={lead.source} channel={lead.channel} /></td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300 max-w-xs truncate" title={lead.summary}>{lead.summary}</td>
                                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <select value={lead.status} onChange={(e) => updateLead(lead, { status: e.target.value })} className={`text-xs rounded-md px-2 py-1 border-0 ${statusColors[lead.status]}`}>
                                                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <select value={lead.owner_id || ""} onChange={(e) => updateLead(lead, { ownerId: e.target.value || null })} className="text-xs rounded-md px-2 py-1 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 max-w-32">
                                                <option value="">Unassigned</option>
                                                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-zinc-400">
                                            {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-zinc-400">
                        <span>{data.total} leads</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded border border-gray-300 dark:border-zinc-700 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                            <span>Page {page} of {pageCount}</span>
                            <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="p-1.5 rounded border border-gray-300 dark:border-zinc-700 disabled:opacity-40"><ChevronRight className="size-4" /></button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {data.total > BOARD_SIZE && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Showing the newest {BOARD_SIZE} of {data.total} leads. Narrow by source, search or date to see older ones.</p>
                    )}
                    {/* Board: drag a card to another column to change its status */}
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {LEAD_STATUSES.map((columnStatus) => {
                            const columnLeads = data.leads.filter((l) => l.status === columnStatus);
                            return (
                                <div key={columnStatus}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => { if (draggedLead && draggedLead.status !== columnStatus) updateLead(draggedLead, { status: columnStatus }); setDraggedLead(null) }}
                                    className="min-w-64 w-64 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 p-3 space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`px-2 py-0.5 text-xs rounded-md ${statusColors[columnStatus]}`}>{columnStatus}</span>
                                        <span className="text-xs text-gray-500 dark:text-zinc-400">{columnLeads.length}</span>
                                    </div>
                                    {columnLeads.map((lead) => (
                                        <div key={leadKey(lead)} draggable onDragStart={() => setDraggedLead(lead)} onClick={() => openLead(lead)}
                                            className="p-3 rounded-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 cursor-grab active:cursor-grabbing hover:border-blue-400 space-y-1.5">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{lead.name || lead.email}</p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">{lead.summary}</p>
                                            <div className="flex items-center justify-between">
                                                <SourceBadge source={lead.source} channel={lead.channel} />
                                                {lead.owner_name && <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">{lead.owner_name}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default Leads;
