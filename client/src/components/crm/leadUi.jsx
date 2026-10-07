import { statusColors, sourceLabels } from "./crm";

export const StatusBadge = ({ status }) => (
    <span className={`px-2 py-0.5 text-xs rounded-md whitespace-nowrap ${statusColors[status] || statusColors.NEW}`}>{status}</span>
);

export const SourceBadge = ({ source }) => (
    <span className="px-2 py-0.5 text-xs rounded-md whitespace-nowrap bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
        {sourceLabels[source] || source}
    </span>
);
