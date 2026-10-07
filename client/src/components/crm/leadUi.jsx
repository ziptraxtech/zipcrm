import { statusColors, sourceLabels, channelInfo } from "./crm";

export const StatusBadge = ({ status }) => (
    <span className={`px-2 py-0.5 text-xs rounded-md whitespace-nowrap ${statusColors[status] || statusColors.NEW}`}>{status}</span>
);

// A lead's origin: its channel (Instagram, WhatsApp, ...) for manually added leads, else the EVChamp form
export const SourceBadge = ({ source, channel }) => {
    const info = channelInfo(channel);
    if (info) {
        const Icon = info.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border whitespace-nowrap ${info.color}`}>
                <Icon className="size-3" /> {info.label}
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 text-xs rounded-md whitespace-nowrap bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
            {sourceLabels[source] || source}
        </span>
    );
};
