import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './observation.service';
import { get } from "lodash";
import { IUser, User } from "../../models/user.model";

export const getObservations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getAll(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const getObservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getDataById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const createObservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await insert(req, res, next);
  } catch (error: any) {
    next(error);
  }
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await updateById(req, res, next);    
  } catch (error: any) {
    next(error);
  }
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await removeById(req, res, next);
  } catch (error: any) {
    next(error);
  }
}