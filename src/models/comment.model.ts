import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComments extends Document {
  work_order_id: Types.ObjectId;
  account_id: Types.ObjectId;
  comments: string;
  parentCommentId?: Types.ObjectId | null;
  visible: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const CommentsSchema: Schema<IComments> = new Schema(
  { 
    work_order_id: { type: Schema.Types.ObjectId, ref: "WorkOrderModel", required: true },
    account_id: { type: Schema.Types.ObjectId, ref: "AccountModel", required: true },
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

export const CommentsModel = mongoose.model<IComments>('Schema_Comments', CommentsSchema);
