import express, { Request, Response, NextFunction } from 'express';
import _, { get } from 'lodash';
import { getAllUsers, createNewUser, updateUserDetails, removeById, getLocationWiseUser } from './user.service';
import { IUser } from '../../models/user.model';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, isActive: true };
    if(userRole !== 'admin') {
      match._id = user_id;
    }
    const data = await getAllUsers(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
   try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, isActive: true };
    if(userRole !== 'admin') {
      match._id = user_id;
    }
    const data = await getAllUsers(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getLocationWiseUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getLocationWiseUser(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const checkMailId = await getAllUsers({ email: body.email });
    if(checkMailId && checkMailId.length > 0) {
      throw Object.assign(new Error('Email already exists'), { status: 400 });
    }
    const checkUserName = await getAllUsers({ username: body.username });
    if(checkUserName && checkUserName.length > 0) {
      throw Object.assign(new Error('Username already exists'), { status: 400 });
    }
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await createNewUser(body);
    res.status(201).json({ status: true, message: "Data created successfully", data: data.userDetails, roleData: data.roleDetails });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: req.params.id, account_id: account_id, isActive: true };
    const userData = await getAllUsers(match);
    if (!userData || userData.length === 0) {
      throw Object.assign(new Error('No data found or already deleted'), { status: 404 });
    }
    req.body.updatedBy = user_id;
    await updateUserDetails(req.params.id, req.body);
    res.status(200).json({ status: true, message: "User updated successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, isActive: true };
    const userData = await getAllUsers(match);
    if (!userData || userData.length === 0) {
      throw Object.assign(new Error('No data found or already deleted'), { status: 404 });
    }
    await removeById(req.params.id);
    res.status(200).json({ status: true, message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}