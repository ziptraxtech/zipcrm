import express from "express";
import { addMember, getUserWorkspaces, removeMember } from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

workspaceRouter.get('/', getUserWorkspaces);
workspaceRouter.post('/add-member', addMember);
workspaceRouter.delete('/:workspaceId/members/:memberId', removeMember);

export default workspaceRouter
