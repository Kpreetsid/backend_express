import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IUserRoleMenu extends Document {
  account_id: ObjectId;
  data: object;
  roleMenu: object;
  user_id: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const userRoleMenuSchema = new Schema<IUserRoleMenu>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  data: { type: Object, required: true },
  roleMenu: { type: Object, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'platform-control',
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
});

export const RoleMenuModel = mongoose.model<IUserRoleMenu>('Schema_RoleMenu', userRoleMenuSchema);
