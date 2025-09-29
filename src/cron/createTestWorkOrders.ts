// import mongoose from "mongoose";
// import dotenv from "dotenv";
// dotenv.config();

// import { WorkOrderModel } from "../models/workOrder.model";
// import { WorkOrderAssigneeModel } from "../models/mapUserWorkOrder.model";
// import { generateOrderNumber } from "../util/generateOrderNumber";

// async function createTestWorkOrders() {
//     try {
//         await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/cmms");
//         console.log("✅ MongoDB connected");

//         // Your test schedule
//         const schedule = {
//             _id: new mongoose.Types.ObjectId("68ce7342c1b4f5b0b318755f"),
//             title: "Test Preventive Maintenance",
//             account_id: new mongoose.Types.ObjectId("68b048fb34b6374580cadb28"),
//             days_to_complete: 3,
//             default_asset_id: new mongoose.Types.ObjectId("68a5a351a9459b990456dbc9"),
//             default_location_id: new mongoose.Types.ObjectId("68a5a2bda9459b990456d903"),
//             default_created_by: new mongoose.Types.ObjectId("68b048fb34b6374580cadb28"),
//             user_mapping: [
//                 new mongoose.Types.ObjectId("68a5a265a9459b990456d844"),
//                 new mongoose.Types.ObjectId("68a6d8646b6aa5a4494ca509"),
//                 new mongoose.Types.ObjectId("68a6ee6c2577ae4a23cffea6")
//             ]
//         };

//         for (const userId of schedule.user_mapping) {
//             for (let i = 0; i < 2; i++) {
//                 const orderNo = await generateOrderNumber();

//                 const startDate = new Date();
//                 const endDate = new Date();
//                 endDate.setDate(startDate.getDate() + schedule.days_to_complete);

//                 const workOrder = await WorkOrderModel.create({
//                     account_id: schedule.account_id,
//                     order_no: orderNo,
//                     title: `${schedule.title} #${i + 1}`,
//                     description: `Auto-generated work order for user ${userId}`,
//                     estimated_time: 4,
//                     priority: "Medium",
//                     status: "Open",
//                     type: "Preventive Maintenance",
//                     wo_asset_id: schedule.default_asset_id,
//                     wo_location_id: schedule.default_location_id,
//                     start_date: startDate,
//                     end_date: endDate,
//                     createdBy: schedule.default_created_by,
//                     visible: true,
//                 });

//                 await WorkOrderAssigneeModel.create({
//                     woId: workOrder._id,
//                     userId
//                 });

//                 console.log(`✅ Work order created: ${orderNo}, assigned to ${userId}`);
//             }
//         }

//         console.log("🎉 All test work orders created successfully!");
//         process.exit(0);
//     } catch (err) {
//         console.error("❌ Error creating test work orders:", err);
//         process.exit(1);
//     }
// }

// createTestWorkOrders();
