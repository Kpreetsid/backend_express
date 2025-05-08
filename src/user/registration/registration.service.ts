import { Account, IAccount } from "../../_models/account.model";
import { User, IUser } from "../../_models/user.model";
import { UserRoleMenu, IUserRoleMenu} from "../../_models/userRoleMenu.model";
import { NextFunction, Request, Response } from 'express';
import { hashPassword } from '../../_config/bcrypt';
import mongoose from "mongoose";

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const newAccount = new Account({
      name: body.name,
      type: body.type,
      description: body.description
    });
    const account: IAccount = await newAccount.save();
    if (!account) {
      const error = new Error("Account creation failed");
      (error as any).status = 500;
      throw error;
    }
    body.account_id = account._id;
    body.isFirstUser = true;
    body.user_role = "admin";
    const safeUser = await createNewUser(body);
    if (!safeUser) {
      const error = new Error("User creation failed");
      (error as any).status = 500;
      throw error;
    }
    const userRoleMenu: IUserRoleMenu = await createUserRoleMenu(safeUser._id as mongoose.Types.ObjectId, account._id as mongoose.Types.ObjectId);
    if (!userRoleMenu) {
      const error = new Error("User role menu creation failed");
      (error as any).status = 500;
      throw error;
    }
    return res.status(201).json({ status: true, message: "Data created successfully", account, user: safeUser, userRoleMenu });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const createNewUser = async (body: IUser) => {
  try {
    const newUser = new User({
      firstName: body.firstName,
      lastName: body.lastName,
      username: body.username,
      email: body.email,
      isFirstUser: body.isFirstUser,
      user_role: body.user_role,
      user_status: body.user_status,
      phone_no: {
        number: body.phone_no.number,
        internationalNumber: body.phone_no.internationalNumber,
        nationalNumber: body.phone_no.nationalNumber,
        e164Number: body.phone_no.e164Number,
        countryCode: body.phone_no.countryCode,
        dialCode: body.phone_no.dialCode
      },
      password: await hashPassword(body.password),
      account_id: body.account_id
    });
    const newUserData = await newUser.save();
    const { password, ...safeUser } = newUserData.toObject();
    return safeUser;
  } catch (error) {
    console.error("Error creating new user:", error);
    throw error;
  }
}

const createUserRoleMenu = async (userId: mongoose.Types.ObjectId, accountId: mongoose.Types.ObjectId) => {
  try {
    const newUserRoleMenu = new UserRoleMenu({
      data: {
        asset: {
          add_asset: true,
          delete_asset: true,
          add_child_asset: true,
          edit_asset: true,
          create_report: true,
          delete_report: true,
          download_report: true,
          edit_report: true,
          config_alarm: true,
          add_observation: true,
          create_endpoint: true,
          edit_endpoint: true,
          delete_end_point: true,
          attach_sensor: true,
          update_config: true
        },
        location: {
          add_location: true,
          delete_location: true,
          add_child_location: true,
          edit_location: true,
          create_report: true,
          delete_report: true,
          download_report: true
        },
        workOrder: {
          create_work_order: true,
          edit_work_order: true,
          delete_work_order: true,
          update_work_order_status: true,
          add_comment_work_order: true,
          add_task_work_order: true,
          update_parts_work_order: true
        },
        floorMap: {
          create_kpi: true,
          view_floor_map: true,
          delete_kpi: true, 
          upload_floor_map: true
        }
      },
      user_id: userId,
      account_id: accountId
    });
    const newUserRoleData = await newUserRoleMenu.save();
    return newUserRoleData.toObject();
  } catch (error) {
    console.error("Error creating user role menu:", error);
    throw error;
  }
}