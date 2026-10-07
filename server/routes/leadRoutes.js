import express from "express";
import { addLeadNote, getLead, getLeads, getLeadStats, updateLead } from "../controllers/leadController.js";

const leadRouter = express.Router();

leadRouter.get("/", getLeads)
leadRouter.get("/stats", getLeadStats)
leadRouter.get("/:source/:sourceId", getLead)
leadRouter.patch("/:source/:sourceId", updateLead)
leadRouter.post("/:source/:sourceId/notes", addLeadNote)

export default leadRouter
