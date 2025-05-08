import { Account, IAccount } from "../../_models/account.model";
import { User, IUser } from "../../_models/user.model";
import { NextFunction, Request, Response } from 'express';
import { hashPassword } from '../../_config/bcrypt';

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
    return res.status(201).json({ status: true, message: "Data created successfully", account, user: safeUser });
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