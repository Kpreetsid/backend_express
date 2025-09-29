// src/config/cronConstants.ts
import mongoose from "mongoose";

export const CRON_CONSTANTS = {
    // Default user ID for work order assignment
    DEFAULT_ASSIGNED_USER_ID: "68a6ee6c2577ae4a23cffea6",

    // Default values for work order creation
    DEFAULT_ASSET_ID: "68a5a351a9459b990456dbc9",    // daily system cleanup
    DEFAULT_LOCATION_ID: "68a5a2bda9459b990456d903",
    DEFAULT_CREATED_BY: "68b048fb34b6374580cadb28",

    // Execution settings
    EXECUTION_TIME: {
        HOUR: 17,    // 5 PM
        MINUTE: 30   // 30 minutes
    },

    // Safety settings
    MIN_HOURS_BETWEEN_EXECUTIONS: 23,

    // Work order defaults
    DEFAULT_DAYS_TO_COMPLETE: 3,
    DEFAULT_ESTIMATED_TIME: 4,
    DEFAULT_PRIORITY: "Medium",
    DEFAULT_STATUS: "Open",
    DEFAULT_TYPE: "Preventive Maintenance",

    // Timezone
    TIMEZONE: "Asia/Kolkata"
};

// Helper function to convert string IDs to ObjectId
export const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);