import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import api from "../../configs/api";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

export const statusColors = {
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    CONTACTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    QUALIFIED: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    PROPOSAL: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    LOST: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400",
};

export const sourceLabels = {
    contact: "Contact & Franchise",
    test_drive: "Test Drive",
    ze_xperience: "Ze.Xperience",
    offer: "Marketplace Offer",
    used_ev: "Used EV Enquiry",
    sell_ev: "Sell My EV",
    service_centre: "Service Centre",
};

export const formatRupees = (paise) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((Number(paise) || 0) / 100);

// GET/PATCH/POST against the CRM API with the Clerk token and current workspace attached
export const useCrmApi = () => {
    const { getToken } = useAuth();
    const workspaceId = useSelector((state) => state?.workspace?.currentWorkspace?.id);

    const request = useCallback(async (method, url, { params, body } = {}) => {
        const headers = { Authorization: `Bearer ${await getToken()}` };
        const { data } = method === "get"
            ? await api.get(url, { headers, params: { workspaceId, ...params } })
            : await api[method](url, { workspaceId, ...body }, { headers });
        return data;
    }, [getToken, workspaceId]);

    return { request, workspaceId };
};

export const errorMessage = (error) => error?.response?.data?.message || error.message;
