import express from "express";
import { getCustomer, getCustomers } from "../controllers/customerController.js";

const customerRouter = express.Router();

customerRouter.get("/", getCustomers)
customerRouter.get("/:clerkId", getCustomer)

export default customerRouter
