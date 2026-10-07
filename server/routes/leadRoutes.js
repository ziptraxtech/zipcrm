import express from "express";
import { addLeadNote, createManualLead, deleteManualLead, getLead, getLeads, getLeadStats, updateLead, updateManualLead } from "../controllers/leadController.js";

const leadRouter = express.Router();

leadRouter.get("/", getLeads)
leadRouter.post("/", createManualLead)
leadRouter.put("/manual/:id", updateManualLead)
leadRouter.delete("/manual/:id", deleteManualLead)
leadRouter.get("/stats", getLeadStats)
leadRouter.get("/:source/:sourceId", getLead)
leadRouter.patch("/:source/:sourceId", updateLead)
leadRouter.post("/:source/:sourceId/notes", addLeadNote)

export default leadRouter
