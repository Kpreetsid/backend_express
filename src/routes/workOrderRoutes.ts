// D:\backend_express\src\routes\workOrderRoutes.ts

import express from "express";
import { listAssignedWorkOrders, testBackendAssignments } from "../controllers/workOrderController";

const router = express.Router();

// GET all work orders with user assignments
router.get("/assigned", listAssignedWorkOrders);

router.get('/test-backend-assignments', testBackendAssignments);

export default router;