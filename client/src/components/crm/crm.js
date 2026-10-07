import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { CalendarDays, Ellipsis, Facebook, Globe, Instagram, Linkedin, Mail, Megaphone, MessageCircle, Phone, Store, Users } from "lucide-react";
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
    manual: "Added manually",
};

// Where a manually added lead came from. Keys match the LeadChannel enum on the server.
export const LEAD_CHANNELS = [
    { key: "INSTAGRAM", label: "Instagram", icon: Instagram, color: "text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-300 dark:bg-pink-500/10 dark:border-pink-500/30" },
    { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle, color: "text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-500/10 dark:border-green-500/30" },
    { key: "FACEBOOK", label: "Facebook", icon: Facebook, color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30" },
    { key: "LINKEDIN", label: "LinkedIn", icon: Linkedin, color: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/30" },
    { key: "GOOGLE_ADS", label: "Google Ads", icon: Megaphone, color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30" },
    { key: "WEBSITE", label: "Website", icon: Globe, color: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/30" },
    { key: "REFERRAL", label: "Referral", icon: Users, color: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/10 dark:border-purple-500/30" },
    { key: "WALK_IN", label: "Walk-in", icon: Store, color: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-500/10 dark:border-orange-500/30" },
    { key: "PHONE_CALL", label: "Phone call", icon: Phone, color: "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-500/10 dark:border-teal-500/30" },
    { key: "EMAIL", label: "Email", icon: Mail, color: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-500/10 dark:border-cyan-500/30" },
    { key: "EVENT", label: "Event", icon: CalendarDays, color: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30" },
    { key: "OTHER", label: "Other", icon: Ellipsis, color: "text-zinc-700 bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-700/40 dark:border-zinc-600" },
];

export const channelInfo = (key) => LEAD_CHANNELS.find((c) => c.key === key);

export const formatRupees = (paise) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((Number(paise) || 0) / 100);

// GET/PATCH/POST against the CRM API with the Clerk token and current workspace attached
export const useCrmApi = () => {
    const { getToken } = useAuth();
    const workspaceId = useSelector((state) => state?.workspace?.currentWorkspace?.id);

    const request = useCallback(async (method, url, { params, body } = {}) => {
        const headers = { Authorization: `Bearer ${await getToken()}` };
        // get/delete carry no body in axios: workspaceId goes in the query string
        const { data } = method === "get" || method === "delete"
            ? await api[method](url, { headers, params: { workspaceId, ...params } })
            : await api[method](url, { workspaceId, ...body }, { headers });
        return data;
    }, [getToken, workspaceId]);

    return { request, workspaceId };
};

export const errorMessage = (error) => error?.response?.data?.message || error.message;
