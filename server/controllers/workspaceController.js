import prisma from "../configs/prisma.js";


// get all workspaces for user
export const getUserWorkspaces = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const workspaces = await prisma.workspace.findMany({
            where: {
                members: {some: {userId: userId}}
            },
            include: {
                members: {include: {user: true}},
                projects: {
                    include:{
                        tasks: {include: {assignee: true, comments: {include: {user: true}}}},
                        members: {include: {user: true}}
                    }
                     
                  },
                  owner: true
            }
        });    
        res.json({workspaces})

        
    } catch (error) {   
        console.log(error);
        res.status(500).json({message: error.code || error.message })
    }
}

// Add member to workspace
export const addMember = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {email,role, workspaceId, message} = req.body;

        // check if user exists
        const user = await prisma.user.findUnique({where: {email}});

        if(!user){
            return res.status(404).json({message: "User not found"})
        }

        if(!workspaceId || !role){
            return res.status(400).json({message: "Missing required parameters"})
        }

        if(!["ADMIN", "MEMBER"].includes(role)){
            return res.status(400).json({message: "Invalid role"})
        }
        //fetch workspace
        const workspace = await prisma.workspace.findUnique({where: {id: workspaceId}, include: {members: true}})

        if(!workspace){
            return res.status(404).json({message: "Workspace not found"})
        }

        // check creator has admin role
        if(!workspace.members.find((member)=> member.userId === userId && member.role === "ADMIN")){
            return res.status(401).json({message: "You do not have admin privileges"})
    }
    // Check if user is already a member
    const existingMember = workspace.members.find((member)=> member.userId === user.id);

    if(existingMember){
        return res.status(400).json({message: "User is already a member of this workspace"})
    }

    const member = await prisma.workspaceMember.create({
        data: {
            userId: user.id,
            workspaceId,
            role,
            message
        }
    })

    res.json({member,message: "Member added successfully"})

    } catch (error) {
        console.log(error);
        res.status(500).json({error: error.code || error.message })
    }
}
// Remove a member from a workspace. Only admins can remove, and only people with the MEMBER role:
// admins can't be removed here (including yourself). Clerk owns memberships, so remove there first;
// otherwise the Clerk sync would add the person straight back.
export const removeMember = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {workspaceId, memberId} = req.params;

        const [caller, target] = await Promise.all([
            prisma.workspaceMember.findUnique({where: {userId_workspaceId: {userId, workspaceId}}}),
            prisma.workspaceMember.findUnique({where: {userId_workspaceId: {userId: memberId, workspaceId}}}),
        ]);
        if (!caller || caller.role !== "ADMIN") {
            return res.status(403).json({message: "Only workspace admins can remove members"});
        }
        if (!target) {
            return res.status(404).json({message: "Member not found in this workspace"});
        }
        if (target.role === "ADMIN") {
            return res.status(403).json({message: "Admins can't be removed. Change their role to Member in Clerk first."});
        }

        const clerk = await fetch(`https://api.clerk.com/v1/organizations/${workspaceId}/memberships/${memberId}`, {
            method: "DELETE",
            headers: {Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`},
        });
        // 404: already gone from Clerk - still clean up our side
        if (!clerk.ok && clerk.status !== 404) {
            console.log(`Clerk membership delete failed: ${clerk.status} ${await clerk.text()}`);
            return res.status(502).json({message: "Couldn't remove the member in Clerk. Try again."});
        }

        // Their tasks and notes stay for the record; they lose access, project memberships and owned leads
        await prisma.$transaction([
            prisma.projectMember.deleteMany({where: {userId: memberId, project: {workspaceId}}}),
            prisma.leadState.updateMany({where: {workspaceId, ownerId: memberId}, data: {ownerId: null}}),
            prisma.workspaceMember.deleteMany({where: {userId: memberId, workspaceId}}),
        ]);

        res.json({message: "Member removed"});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}
