import mongoose, { Schema, Document, Types } from "mongoose";

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
        delete (ret as any)._id;
        return ret;
      }
    }
  }
);

export const CommentsModel = mongoose.model<IComments>('Schema_Comments', CommentsSchema);
