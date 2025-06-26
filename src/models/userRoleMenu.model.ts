import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface AssetPermissions {
  add_asset: boolean;
  delete_asset: boolean;
  add_child_asset: boolean;
  edit_asset: boolean;
  create_report: boolean;
  delete_report: boolean;
  download_report: boolean;
  edit_report: boolean;
  config_alarm: boolean;
  add_observation: boolean;
  create_endpoint: boolean;
  edit_endpoint: boolean;
  delete_end_point: boolean;
  attach_sensor: boolean;
  update_config: boolean;
}

interface LocationPermissions {
  add_location: boolean;
  delete_location: boolean;
  add_child_location: boolean;
  edit_location: boolean;
  create_report: boolean;
  delete_report: boolean;
  download_report: boolean;
}

interface WorkOrderPermissions {
  create_work_order: boolean;
  edit_work_order: boolean;
  delete_work_order: boolean;
  update_work_order_status: boolean;
  add_comment_work_order: boolean;
  add_task_work_order: boolean;
  update_parts_work_order: boolean;
}

interface FloorMapPermissions {
  create_kpi: boolean;
  view_floor_map: boolean;
  delete_kpi: boolean;
  upload_floor_map: boolean;
}

export interface IUserRoleMenu extends Document {
  data: {
    asset: AssetPermissions;
    location: LocationPermissions;
    workOrder: WorkOrderPermissions;
    floorMap: FloorMapPermissions;
  };
  user_id: ObjectId;
  account_id: ObjectId;
}

const userRoleMenuSchema = new Schema<IUserRoleMenu>({
  data: {
    asset: {
      add_asset: { type: Boolean, default: false },
      delete_asset: { type: Boolean, default: false },
      add_child_asset: { type: Boolean, default: false },
      edit_asset: { type: Boolean, default: false },
      create_report: { type: Boolean, default: false },
      delete_report: { type: Boolean, default: false },
      download_report: { type: Boolean, default: false },
      edit_report: { type: Boolean, default: false },
      config_alarm: { type: Boolean, default: false },
      add_observation: { type: Boolean, default: false },
      create_endpoint: { type: Boolean, default: false },
      edit_endpoint: { type: Boolean, default: false },
      delete_end_point: { type: Boolean, default: false },
      attach_sensor: { type: Boolean, default: false },
      update_config: { type: Boolean, default: false }
    },
    location: {
      add_location: { type: Boolean, default: false },
      delete_location: { type: Boolean, default: false },
      add_child_location: { type: Boolean, default: false },
      edit_location: { type: Boolean, default: false },
      create_report: { type: Boolean, default: false },
      delete_report: { type: Boolean, default: false },
      download_report: { type: Boolean, default: false }
    },
    workOrder: {
      create_work_order: { type: Boolean, default: false },
      edit_work_order: { type: Boolean, default: false },
      delete_work_order: { type: Boolean, default: false },
      update_work_order_status: { type: Boolean, default: false },
      add_comment_work_order: { type: Boolean, default: false },
      add_task_work_order: { type: Boolean, default: false },
      update_parts_work_order: { type: Boolean, default: false }
    },
    floorMap: {
      create_kpi: { type: Boolean, default: false },
      view_floor_map: { type: Boolean, default: false },
      delete_kpi: { type: Boolean, default: false },
      upload_floor_map: { type: Boolean, default: false }
    }
  },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }
}, {
  collection: 'platform-control',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
});

export const UserRoleMenu = mongoose.model<IUserRoleMenu>('UserRoleMenu', userRoleMenuSchema);
