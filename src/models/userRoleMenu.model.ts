import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const USER_ROLE_MENU_COLLECTION_NAME = 'platform-control';


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
  collection: USER_ROLE_MENU_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

userRoleMenuSchema.index({ user_id: 1, account_id: 1 });

export const RoleMenuModel = mongoose.model<IUserRoleMenu>('Schema_RoleMenu', userRoleMenuSchema);
