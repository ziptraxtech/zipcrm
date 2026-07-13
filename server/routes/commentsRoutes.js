import express from "express";
import { addComment, getTaskComments } from "../controllers/commentsController.js";

const commentsRouter = express.Router()

commentsRouter.post('/', addComment);
commentsRouter.get('/:taskId', getTaskComments)

export default commentsRouter
