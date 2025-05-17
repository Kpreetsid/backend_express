import { Account, IAccount, createAccount } from "../../models/account.model";
import { User, IUser } from "../../models/user.model";
import { UserRoleMenu, IUserRoleMenu} from "../../models/userRoleMenu.model";
import { NextFunction, Request, Response } from 'express';
import { hashPassword } from '../../_config/bcrypt';
import mongoose from "mongoose";
import { platformControlData } from "../../_config/userRoles";

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const account: IAccount = await createAccount(new Account({
      name: body.name,
      type: body.type,
      description: body.description
    }));
    if (!account) {
      throw Object.assign(new Error('Account creation failed'), { status: 500 });
    }
    body.account_id = account._id;
    body.isFirstUser = true;
    body.user_role = "admin";
    const safeUser = await createNewUser(body);
    if (!safeUser) {
      throw Object.assign(new Error('User creation failed'), { status: 500 });
    }
    const userRoleMenu: IUserRoleMenu = await createUserRoleMenu(safeUser._id as mongoose.Types.ObjectId, account._id as mongoose.Types.ObjectId);
    if (!userRoleMenu) {
      throw Object.assign(new Error('User role menu creation failed'), { status: 500 });
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
      user_id: userId,
      account_id: accountId,
      data: await platformControlData("admin")
    });
    const newUserRoleData = await newUserRoleMenu.save();
    return newUserRoleData.toObject();
  } catch (error) {
    console.error("Error creating user role menu:", error);
    throw error;
  }
}