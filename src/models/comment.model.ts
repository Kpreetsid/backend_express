import mongoose, { Schema, Document } from "mongoose";
import { ObjectId } from "mongodb";

export interface IComments extends Document {
  account_id: ObjectId;
  order_id?: ObjectId;
  post_id?: ObjectId;
  comments: string;
  parentCommentId?: ObjectId | null;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const CommentsSchema: Schema<IComments> = new Schema(
  { 
    account_id: { type: Schema.Types.ObjectId, ref: "AccountModel", required: true },
    order_id: { type: Schema.Types.ObjectId, ref: "WorkOrderModel" },
    post_id: { type: Schema.Types.ObjectId, ref: "Schema_Post" },
    comments: { type: String, required: true, trim: true },
    parentCommentId: { type: Schema.Types.ObjectId, ref: "Schema_Comments", default: null },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserModel", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserModel" }
  },
  {
    collection: 'work_order_comment',
    timestamps: true,
    versionKey: false
  }
);

export const CommentsModel = mongoose.model<IComments>("Schema_Comments", CommentsSchema);