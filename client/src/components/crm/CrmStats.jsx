import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, Sparkles, CircleDashed, Trophy } from "lucide-react";
import { useCrmApi } from "./crm";

// Lead tiles for the dashboard. Hidden if the CRM is not enabled for this workspace.
export default function CrmStats() {
    const navigate = useNavigate();
    const { request, workspaceId } = useCrmApi();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!workspaceId) return;
        let ignore = false;
        request("get", "/api/leads/stats")
            .then((res) => { if (!ignore) setStats(res.stats) })
            .catch(() => { if (!ignore) setStats(null) });
        return () => { ignore = true };
    }, [request, workspaceId]);

    if (!stats) return null;

    const cards = [
        { icon: Inbox, title: "Total Leads", value: stats.total, subtitle: "from EVChamp", color: "text-blue-500", bg: "bg-blue-500/10" },
        { icon: Sparkles, title: "New This Week", value: stats.new_this_week, subtitle: "last 7 days", color: "text-purple-500", bg: "bg-purple-500/10" },
        { icon: CircleDashed, title: "Untouched", value: stats.untouched, subtitle: "still NEW", color: "text-amber-500", bg: "bg-amber-500/10" },
        { icon: Trophy, title: "Won", value: stats.won, subtitle: "converted leads", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-9">
            {cards.map(({ icon, title, value, subtitle, color, bg }) => { const Icon = icon; return (
                <button key={title} onClick={() => navigate("/leads")} className="text-left bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition duration-200 rounded-md p-6 py-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{title}</p>
                            <p className="text-3xl font-bold text-zinc-800 dark:text-white">{value}</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{subtitle}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${bg}`}><Icon size={20} className={color} /></div>
                    </div>
                </button>
            ); })}
        </div>
    );
}
