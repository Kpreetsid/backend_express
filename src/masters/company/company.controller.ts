import { get } from "lodash";
import { IUser } from '../../models/user.model';
import { NextFunction, Request, Response } from 'express';
import { getAllCompanies, createCompany, updateById } from './company.service';
import mongoose from "mongoose";
import {  redisGet, redisSet, redisDelete, redisDeletePattern, buildCacheKey } from "../../_redis/redis.operation";

export const getCompanies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { type } = req.query;
    const cacheKey = `companies:${account_id}:${type || "all"}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, cached: true, message: "Data fetched successfully (cache)", data: JSON.parse(cached) });
      return;
    }
    const match: any = { _id: account_id, visible: true };
    if (type) match.type = type;
    const data = await getAllCompanies(match);
    if (!data.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
    await redisSet(cacheKey, JSON.stringify(data), 600);
  } catch (error) {
    next(error);
  }
};

export const getCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
    if (`${account_id}` !== id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
    const match = { visible: true, _id: new mongoose.Types.ObjectId(id)};
    const cacheKey = buildCacheKey("company", id);
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({
        status: true,
        cached: true,
        message: "Data fetched successfully (cache)",
        data: cached
      });
      return;
    }
    const data = await getAllCompanies(match);
    if (!data.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newCompany = {
      account_name: req.body.account_name,
      type: req.body.type,
      description: req.body.description
    };
    const data = await createCompany(newCompany);
    if (!data) throw Object.assign(new Error("Data creation failed"), { status: 500 });
    await redisDeletePattern("companies:*");
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { account_name, type, description } = req.body;
    if (!id) throw Object.assign(new Error("No data found"), { status: 404 });
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if (`${account_id}` !== id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
    const updatedObj = {
      account_name,
      type,
      description,
      updatedBy: user_id
    };
    const data = await updateById(id, updatedObj);
    if (!data) throw Object.assign(new Error("Data update failed"), { status: 500 });
    await redisDelete(buildCacheKey("company", id));
    await redisDeletePattern("companies:*");
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateImageCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { params: { id }, body: { fileName }} = req;
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if (!id) throw Object.assign(new Error("No data found"), { status: 404 });
    if (!fileName) throw Object.assign(new Error("File name is required"), { status: 400 });
    if (`${account_id}` !== id) throw Object.assign(new Error("Invalid ID"), { status: 400 });
    const updatedObj = { fileName, updatedBy: user_id };
    const data = await updateById(id, updatedObj);
    if (!data) throw Object.assign(new Error("Data update failed"), { status: 500 });
    await redisDelete(buildCacheKey("company", id));
    await redisDeletePattern("companies:*");
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id) throw Object.assign(new Error("No data found"), { status: 404 });
    await redisDelete(buildCacheKey("company", id));
    await redisDeletePattern("companies:*");
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};