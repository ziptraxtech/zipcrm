import { useState } from "react";
import { useDispatch } from "react-redux";
import { useAuth, useClerk, useOrganizationList, useUser } from "@clerk/clerk-react";
import { Building2, Loader2Icon, LogOut, MailOpen } from "lucide-react";
import toast from "react-hot-toast";
import { fetchWorkspaces } from "../features/workspaceSlice";

// Shown to a signed-in person who belongs to no workspace yet. Workspaces are joined by
// invitation only, so instead of offering to create an organization this lists their
// pending invitations, or tells them to ask an admin for one.
export default function NoWorkspace() {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { user } = useUser();
    const { signOut } = useClerk();
    const { isLoaded, setActive, userInvitations } = useOrganizationList({ userInvitations: { infinite: true } });
    const [joiningId, setJoiningId] = useState(null);

    const invitations = (userInvitations?.data || []).filter((inv) => inv.status === "pending");

    const accept = async (invitation) => {
        setJoiningId(invitation.id);
        try {
            await invitation.accept();
            await setActive({ organization: invitation.publicOrganizationData.id });
            // The membership reaches zipcrm's database through the Clerk webhook a few seconds later
            for (let attempt = 0; attempt < 10; attempt++) {
                const { payload } = await dispatch(fetchWorkspaces({ getToken }));
                if (payload?.length) return;
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            toast.error("Joined, but the workspace is still syncing. Refresh in a minute.");
        } catch (error) {
            toast.error(error?.errors?.[0]?.longMessage || error.message);
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 p-4">
            <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-zinc-800 p-6 space-y-5 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50">
                <div>
                    <h1 className="text-xl font-semibold">Join your team's workspace</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                        Signed in as <span className="font-medium text-gray-700 dark:text-zinc-200">{user?.primaryEmailAddress?.emailAddress}</span>
                    </p>
                </div>

                {!isLoaded || userInvitations?.isLoading ? (
                    <div className="flex justify-center py-6"><Loader2Icon className="size-6 text-blue-500 animate-spin" /></div>
                ) : invitations.length ? (
                    <div className="space-y-3">
                        {invitations.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-200 dark:border-zinc-700">
                                <div className="flex items-center gap-3 min-w-0">
                                    {inv.publicOrganizationData.hasImage
                                        ? <img src={inv.publicOrganizationData.imageUrl} alt="" className="size-9 rounded" />
                                        : <div className="size-9 rounded bg-blue-500/10 flex items-center justify-center"><Building2 className="size-4 text-blue-500" /></div>}
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{inv.publicOrganizationData.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">Invited as {inv.role === "org:admin" ? "Admin" : "Member"}</p>
                                    </div>
                                </div>
                                <button onClick={() => accept(inv)} disabled={joiningId !== null} className="px-4 py-1.5 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
                                    {joiningId === inv.id ? "Joining..." : "Accept"}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 space-y-2">
                        <MailOpen className="size-8 mx-auto text-gray-400 dark:text-zinc-500" />
                        <p className="text-sm text-gray-600 dark:text-zinc-300">You haven't been added to a workspace yet.</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Ask a workspace admin to invite this email address, then refresh this page.</p>
                    </div>
                )}

                <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                    <LogOut className="size-4" /> Sign in with a different account
                </button>
            </div>
        </div>
    );
}
