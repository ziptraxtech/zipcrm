import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import workspaceRouter from './routes/workspaceRoutes.js';
import { protect } from './middlewares/authMiddleware.js';
import projectRouter from './routes/projectRoutes.js';
import taskRouter from './routes/taskRoutes.js';
import commentsRouter from './routes/commentsRoutes.js';
import leadRouter from './routes/leadRoutes.js';
import customerRouter from './routes/customerRoutes.js';




const app = express();

app.use(express.json());
// Only the CRM client may call this API; allow any origin in local dev when CLIENT_URL is unset
const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean)
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : process.env.NODE_ENV === 'development' ? {} : { origin: false }))
app.use(clerkMiddleware());


app.get('/', (req, res) => res.send('Server is live! '));

app.use("/api/inngest", serve({ client: inngest, functions }));

// Routes
app.use("/api/workspaces", protect, workspaceRouter)
app.use("/api/projects", protect, projectRouter)
app.use("/api/tasks", protect, taskRouter)
app.use("/api/comments", protect, commentsRouter)
app.use("/api/leads", protect, leadRouter)
app.use("/api/customers", protect, customerRouter)

const PORT = process.env.PORT || 5000

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))