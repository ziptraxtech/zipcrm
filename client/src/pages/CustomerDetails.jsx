import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, Mail } from "lucide-react";
import { formatRupees, useCrmApi, errorMessage } from "../components/crm/crm";
import { StatusBadge, SourceBadge } from "../components/crm/leadUi";

const CustomerDetails = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clerkId = searchParams.get("id");
    const { request, workspaceId } = useCrmApi();

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId || !clerkId) return;
        let ignore = false;
        setLoading(true);
        request("get", `/api/customers/${encodeURIComponent(clerkId)}`)
            .then((res) => { if (!ignore) setDetail(res) })
            .catch((error) => { if (!ignore) toast.error(errorMessage(error)) })
            .finally(() => { if (!ignore) setLoading(false) });
        return () => { ignore = true };
    }, [request, workspaceId, clerkId]);

    if (loading) return <div className="p-6 text-center text-sm text-gray-500 dark:text-zinc-400">Loading customer...</div>;
    if (!detail) return <div className="p-6 text-center text-red-500">Customer not found</div>;

    const { customer, purchases, leads } = detail;
    const cardClasses = "rounded-lg border border-gray-300 dark:border-zinc-800 p-5 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50";

    return (
        <div className="max-w-6xl mx-auto space-y-6 text-gray-900 dark:text-zinc-100">
            <button onClick={() => navigate("/customers")} className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="size-4" /> Back to customers
            </button>

            <div className="flex items-center gap-4">
                {customer.image_url ? <img src={customer.image_url} alt="" className="size-14 rounded-full" /> : <div className="size-14 rounded-full bg-gray-200 dark:bg-zinc-800" />}
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">{customer.name || customer.email}</h1>
                    {customer.email && <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-300 hover:text-blue-500"><Mail className="size-4" />{customer.email}</a>}
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                {[
                    ["Total spent", formatRupees(customer.total_paise)],
                    ["Purchases", customer.purchase_count],
                    ["Joined", customer.created_at ? format(new Date(customer.created_at), "dd MMM yyyy") : "—"],
                    ["Last sign-in", customer.last_sign_in_at ? format(new Date(customer.last_sign_in_at), "dd MMM yyyy") : "—"],
                ].map(([label, v]) => (
                    <div key={label} className={`${cardClasses} max-sm:w-full min-w-40`}>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
                        <p className="text-xl font-bold">{v}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className={cardClasses}>
                    <h2 className="font-semibold mb-3">Plan purchases</h2>
                    {purchases.length === 0 ? <p className="text-sm text-gray-500 dark:text-zinc-400">No purchases</p> : (
                        <div className="divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                            {purchases.map((p) => (
                                <div key={p.id} className="py-2 flex justify-between gap-4">
                                    <div>
                                        <p className="font-medium">{p.plan_name || p.description || "Plan"}</p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">{format(new Date(p.created_at), "dd MMM yyyy, HH:mm")} · {p.razorpay_payment_id}</p>
                                    </div>
                                    <span className="whitespace-nowrap">{p.currency === "INR" ? formatRupees(p.amount_paise) : `${(p.amount_paise / 100).toFixed(2)} ${p.currency}`}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={cardClasses}>
                    <h2 className="font-semibold mb-3">Enquiries</h2>
                    {leads.length === 0 ? <p className="text-sm text-gray-500 dark:text-zinc-400">No enquiries with this email</p> : (
                        <div className="space-y-2">
                            {leads.map((l) => (
                                <button key={`${l.source}:${l.source_id}`} onClick={() => navigate(`/leadDetails?source=${l.source}&id=${l.source_id}`)} className="w-full text-left p-2 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-sm space-y-1">
                                    <div className="flex items-center gap-2">
                                        <SourceBadge source={l.source} /><StatusBadge status={l.status} />
                                        <span className="text-xs text-gray-500 dark:text-zinc-400 ml-auto">{format(new Date(l.created_at), "dd MMM yyyy")}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{l.summary}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerDetails;
