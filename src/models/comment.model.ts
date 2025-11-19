import mongoose, { Schema, Document, Types } from "mongoose";
import Joi from "joi";
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message("Invalid ObjectId format");

export interface IComments extends Document {
  account_id: Types.ObjectId;
  order_id: Types.ObjectId;
  comments: string;
  parentCommentId?: Types.ObjectId | null;
  visible: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const CommentsSchema: Schema<IComments> = new Schema(
  { 
    account_id: { type: Schema.Types.ObjectId, ref: "AccountModel", required: true },
    order_id: { type: Schema.Types.ObjectId, ref: "WorkOrderModel", required: true },
    comments: { type: String, required: true, trim: true },
    parentCommentId: { type: Schema.Types.ObjectId, ref: "CommentModel", default: null },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserModel", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserModel" }
  },
  {
    collection: 'work_order_comment',
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const CommentsModel = mongoose.model<IComments>("Schema_Comments", CommentsSchema);

export const createCommentSchema = Joi.object({
  comments: Joi.string().min(1).required(),
  parentCommentId: objectId.allow(null)
}).unknown(false);

export const updateCommentSchema = Joi.object({
  comments: Joi.string().min(1),
  parentCommentId: objectId.allow(null)
}).unknown(false);
