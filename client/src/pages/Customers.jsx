import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Contact, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRupees, useCrmApi, errorMessage } from "../components/crm/crm";

const PAGE_SIZE = 25;

const Customers = () => {
    const navigate = useNavigate();
    const { request, workspaceId } = useCrmApi();

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ customers: [], total: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (!workspaceId) return;
        let ignore = false;
        setLoading(true);
        request("get", "/api/customers", { params: { q: debouncedSearch || undefined, page, limit: PAGE_SIZE } })
            .then((res) => { if (!ignore) setData(res) })
            .catch((error) => { if (!ignore) toast.error(errorMessage(error)) })
            .finally(() => { if (!ignore) setLoading(false) });
        return () => { ignore = true };
    }, [request, workspaceId, debouncedSearch, page]);

    const pageCount = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">Customers</h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">People signed up on EVChamp, with their plan purchases</p>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3" />
                <input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full text-sm rounded-md border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            {loading && data.customers.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-500 dark:text-zinc-400">Loading customers...</div>
            ) : data.customers.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <Contact className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No customers found</h3>
                </div>
            ) : (
                <>
                    <div className={`overflow-x-auto rounded-md border border-gray-200 dark:border-zinc-800 ${loading ? "opacity-60" : ""}`}>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-900/50">
                                <tr>
                                    {["Customer", "Purchases", "Total spent", "Leads", "Joined", "Last sign-in"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {data.customers.map((c) => (
                                    <tr key={c.clerk_id} onClick={() => navigate(`/customerDetails?id=${encodeURIComponent(c.clerk_id)}`)} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                                        <td className="px-4 py-2.5 flex items-center gap-3">
                                            {c.image_url ? <img src={c.image_url} alt="" className="size-7 rounded-full" /> : <div className="size-7 rounded-full bg-gray-200 dark:bg-zinc-800" />}
                                            <div>
                                                <p className="text-zinc-900 dark:text-white">{c.name || "—"}</p>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400">{c.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{c.purchase_count}</td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{c.purchase_count ? formatRupees(c.total_paise) : "—"}</td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{c.lead_count}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-zinc-400">{c.created_at ? format(new Date(c.created_at), "dd MMM yyyy") : "—"}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-zinc-400">{c.last_sign_in_at ? format(new Date(c.last_sign_in_at), "dd MMM yyyy") : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-zinc-400">
                        <span>{data.total} customers</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded border border-gray-300 dark:border-zinc-700 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                            <span>Page {page} of {pageCount}</span>
                            <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="p-1.5 rounded border border-gray-300 dark:border-zinc-700 disabled:opacity-40"><ChevronRight className="size-4" /></button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Customers;
