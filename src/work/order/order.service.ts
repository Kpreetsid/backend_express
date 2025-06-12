import { WorkOrder, IWorkOrder } from "../../models/workOrder.model";
import { Request, Response, NextFunction } from 'express';
import { IUser } from "../../models/user.model";
import { get } from "lodash";
import { getData } from "../../util/queryBuilder";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if(query.id) {
      match._id = { $in: query.id.toString().split(',') };
    }
    if(query.status) {
      match.status = { $in: query.status.toString().split(',') };
    }
    if(query.priority) {
      match.priority = { $in: query.priority.toString().split(',') };
    }
    if(query.order_no) {
      match.order_no = { $in: query.order_no.toString().split(',') };
    }
    if(query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    if(userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    const data = await getData(WorkOrder, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const orderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if(query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    if(userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    const data: any = await getData(WorkOrder, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let result = [
      { key: 'Open', value: 0 }, 
      { key: 'On-Hold', value: 0 }, 
      { key: 'In-Progress', value: 0 }, 
      { key: 'Completed', value: 0 }
    ];
    data.forEach((item: any) => {
      if(item.status === 'Open') {
        result[0].value = result[0].value + 1;
      } else if(item.status === 'On-Hold') {
        result[1].value = result[1].value + 1;
      } else if(item.status === 'In-Progress') {
        result[2].value = result[2].value + 1;
      } else if(item.status === 'Completed') {
        result[3].value = result[3].value + 1;
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const orderPriority = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if(query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    if(userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    const data: any = await getData(WorkOrder, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let result = [
      { key: 'High', value: 0 }, 
      { key: 'Medium', value: 0 }, 
      { key: 'Low', value: 0 },
      { key: 'None', value: 0 }
    ];
    data.forEach((item: any) => {
      if(item.priority === 'High') {
        result[0].value = result[0].value + 1;
      } else if(item.priority === 'Medium') {
        result[1].value = result[1].value + 1;
      } else if(item.priority === 'Low') {
        result[2].value = result[2].value + 1;
      } else if(item.priority === 'None') {
        result[3].value = result[3].value + 1;
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await WorkOrder.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) { 
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    req.body.account_id = account_id;
    req.body.user_id = user_id;
    const newAsset = new WorkOrder(req.body);
    const data = await newAsset.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const data = await WorkOrder.findByIdAndUpdate(id, body, { new: true });
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await WorkOrder.findById(id);
    if (!data || !data.visible) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await WorkOrder.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};