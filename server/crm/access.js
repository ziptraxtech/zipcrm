import prisma from "../configs/prisma.js";

// Workspaces allowed to see EVChamp customer data. Clerk sign-up is open, so anyone could
// create their own organization; without this list they would become ADMIN of a workspace
// and see every lead. Unset in local development = allow all.
const allowedWorkspaces = (process.env.CRM_WORKSPACE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)

const workspaceMayUseCrm = (workspaceId) => {
    if (allowedWorkspaces.length) return allowedWorkspaces.includes(workspaceId)
    return process.env.NODE_ENV === 'development'
}

// Resolves the caller's membership of a CRM-enabled workspace, or sends the error response.
// Usage: const member = await requireCrmMember(req, res, workspaceId); if (!member) return;
export const requireCrmMember = async (req, res, workspaceId) => {
    const {userId} = await req.auth();

    if (!workspaceId) {
        res.status(400).json({message: "workspaceId is required"});
        return null;
    }
    if (!workspaceMayUseCrm(workspaceId)) {
        res.status(403).json({message: "CRM is not enabled for this workspace"});
        return null;
    }

    const member = await prisma.workspaceMember.findUnique({
        where: {userId_workspaceId: {userId, workspaceId}}
    })
    if (!member) {
        res.status(403).json({message: "You are not a member of this workspace"});
        return null;
    }
    return member;
}
