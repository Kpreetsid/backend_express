import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface IPhoneNumber {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

interface IUser {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailStatus: boolean;
  user_status: string;
  user_role: string;
  createdOn: Date;
  id: string;
  account_id: string;
  phone_no: IPhoneNumber;
  isFirstUser: boolean;
}

interface IComment {
  commentId: number;
  createdDate: Date;
  newCommentText: string | null;
  replyComment: string[];
  user: IUser;
}

export interface IComments extends Document {
  createdOn: Date;
  order_id: ObjectId;
  comments: IComment[];
}

// Phone number schema
const PhoneNumberSchema = new Schema<IPhoneNumber>({
  number: String,
  internationalNumber: String,
  nationalNumber: String,
  e164Number: String,
  countryCode: String,
  dialCode: String,
}, { _id: false });

// User schema
const UserSchema = new Schema<IUser>({
  firstName: String,
  lastName: String,
  username: String,
  email: String,
  emailStatus: Boolean,
  user_status: String,
  user_role: String,
  createdOn: Date,
  id: String,
  account_id: String,
  phone_no: PhoneNumberSchema,
  isFirstUser: Boolean,
}, { _id: false });

// Comment schema
const CommentSchema = new Schema<IComment>({
  commentId: Number,
  createdDate: Date,
  newCommentText: { type: String },
  replyComment: { type: [String] },
  user: { type: UserSchema, required: true },
}, { _id: false });

// Main Comments schema
const CommentsSchema = new Schema<IComments>({
  createdOn: { type: Date, default: Date.now },
  order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  comments: { type: [CommentSchema] },
}, {
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
});

export const Comments = mongoose.model<IComments>('Comments', CommentsSchema);
