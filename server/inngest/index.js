import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
//import { assign } from "nodemailer/lib/shared";
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "Zip-crm" });

// Create or refresh a user from a Clerk user object (webhook payload or Backend API response)
const upsertUser = async (clerkUser) => {
    const primary = clerkUser.email_addresses?.find((e) => e.id === clerkUser.primary_email_address_id) || clerkUser.email_addresses?.[0]
    const data = {
        email: primary?.email_address,
        name: [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') || clerkUser.username || 'Unnamed user',
        image: clerkUser.image_url || '',
    }
    await prisma.user.upsert({where: {id: clerkUser.id}, create: {id: clerkUser.id, ...data}, update: data})
}

// Add or update a workspace membership. Clerk can deliver membership events before (or without)
// user.created for someone who signed up through an invite link, so fetch the user if it's missing.
const ensureUser = async (userId) => {
    if (await prisma.user.findUnique({where: {id: userId}})) return
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: {Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`}
    })
    if (!res.ok) throw new Error(`Clerk user ${userId}: ${res.status}`)
    await upsertUser(await res.json())
}

const upsertMembership = async (userId, workspaceId, clerkRole) => {
    await ensureUser(userId)
    const role = clerkRole === 'org:admin' ? 'ADMIN' : 'MEMBER'
    await prisma.workspaceMember.upsert({
        where: {userId_workspaceId: {userId, workspaceId}},
        create: {userId, workspaceId, role},
        update: {role},
    })
}


// Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
    {event: 'clerk/user.created'},
    async ({event})=>{
        const {data} = event
        await upsertUser(data)
    }
)

// Inngest function to delete  user data to a database
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-from-clerk'},
    {event: 'clerk/user.deleted'},
    async ({event})=>{
        const {data} = event
        await prisma.user.delete({
            where: {
                id: data.id,
            
            }
        })
    }
)

// Inngest function to update user data to a database
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    {event: 'clerk/user.updated'},
    async ({event})=>{
        const {data} = event
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: [data?.first_name, data?.last_name].filter(Boolean).join(' ') || data?.username || 'Unnamed user',
                image: data?.image_url,
            }
        })
    }
)

//iNNGEST FUnction to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
    {id: 'sync-workspace-from-clerk' },
    {event: 'clerk/organization.created'},
    async ({event}) => {
        const {data} = event;
        // The creator must exist before the workspace can reference them as owner
        await ensureUser(data.created_by)
        const workspace = {name: data.name, slug: data.slug || data.id, ownerId: data.created_by, image_url: data.image_url || ''}
        await prisma.workspace.upsert({where: {id: data.id}, create: {id: data.id, ...workspace}, update: workspace})

        // Add creator as ADMIN member (organizationMembership.created may already have done this)
        await upsertMembership(data.created_by, data.id, 'org:admin')
    }
)


// Inngest Function to update workspace data in database
const syncWorkspaceUpdation = inngest.createFunction(
    {id: 'update-workspace-from-clerk'},
    {event: 'clerk/organization.updated'},
    async ({event}) => {
        const { data } = event;
        await prisma.workspace.update({
            where: {
                id: data.id
            },
            data: {
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        })
    }
)

// Inngest fuction to delete workspace from  database

const syncWorkspaceDeletion = inngest.createFunction(
    { id: 'delete-workspace-with-clerk'},
    {event: 'clerk/organization.deleted'},
    async ({event}) => {
        const {data} = event;
        await prisma.workspace.delete({
            where: {
                id: data.id
            }
        })
    }
)

//Inngest function to save workspace member data to a database

const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: 'sync-workspace-member-from-clerk'},
    {event: 'clerk/organizationInvitation.accepted'},
    async ({event}) => {
        const {data} = event;
        await upsertMembership(data.user_id, data.organization_id, data.role)
    }
)

// Memberships added, changed or removed anywhere (zipcrm invites, the Clerk dashboard, Clerk's API)
const syncMembershipUpsert = inngest.createFunction(
    {id: 'sync-membership-from-clerk'},
    [{event: 'clerk/organizationMembership.created'}, {event: 'clerk/organizationMembership.updated'}],
    async ({event}) => {
        const {data} = event;
        await upsertMembership(data.public_user_data.user_id, data.organization.id, data.role)
    }
)

const syncMembershipDeletion = inngest.createFunction(
    {id: 'delete-membership-with-clerk'},
    {event: 'clerk/organizationMembership.deleted'},
    async ({event}) => {
        const {data} = event;
        await prisma.workspaceMember.deleteMany({
            where: {userId: data.public_user_data.user_id, workspaceId: data.organization.id}
        })
    }
)

// Inngest fxn to send email
const sendTaskAssignmentEmail = inngest.createFunction(
    {id: "send-task-assignment-mail"},
    {event: "app/task.assigned"},
    async ({event, step}) => {
        const {taskId, origin} = event.data;

        const task = await prisma.task.findUnique({
            where: {id: taskId},
            include: {assignee: true, project: true}
        })
        await sendEmail({
            to: task.assignee.email,
            subject: `New Task Assignment in ${task.project.name}`,
            body: `<div style = "max-width: 600px;">
            <h2> Hi ${task.assignee.name}, </h2>
            
            <p style="font-size: 16px;">You've been assigned a new task: </p>
            <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${task.title}</p>
            
            <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                <p style="margin: 6px 0;"><strong>Description:</strong> ${task.description}</p>
                <p style="margin: 6px 0;"><strog>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
            </div>
            
            <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
                view Task
            </a>
            
            <p style= "margin-top: 20; font-size: 14px; color: #6c757d;">
                Please make sure to review and complete it before the due date.
            </p>
            </div> `
        })
        if(new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()){
            await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

            await step.run('check-if-task-is-completed', async () => {
                const task = await prisma.task.findUnique({
                    where: {id: taskId},
                    include: {assignee: true, project: true}
              })

              if(!task) return;

              if(task.status !== "DONE"){
                await step.run('send-task-remainder-mail',async () => {
                    await sendEmail({
                        to: task.assignee.email,
                        subject: `Remainder for ${task.project.name}`,
                        body: `<div style="max-width: 600px;">
                               <h2>Hi ${task.assignee.name}, </h2>
                               
                               <p style="font-size:16px;"> You have a task due in ${task.project.name}: </p>
                               <p style = "font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0; ">${task.title} </p>
                               
                               <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                                    <p style="margin: 6px 0; "><strong>Description:</strong> ${task.description} </p>
                                    <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
                                </div>
                                
                                <a href="${origin}" style="background-color: #007bff; paddingL 12px 24px; border-radius: 5px; color: #fff; font-weigt: 600; font-size:16px; text-decoration: none;">
                                    View Task
                                </a>
                                <p style= "margin-top: 20px; font-size: 14px; colorL #6c757d;">
                                    Please make sure to review and complete it before the due date.
                                </p>
                                </div>`                    })
                })
              }
            })
        }
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncMembershipUpsert,
    syncMembershipDeletion,
    syncUserCreation, 
    syncUserDeletion, 
    syncUserUpdation, 
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    sendTaskAssignmentEmail,

];

