import { ReportAsset, IReportAsset } from "../../_models/assetReport.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = req.user;
    const data = await ReportAsset.find({account_id: account_id}).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await ReportAsset.findById(id);
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportAsset = new ReportAsset(req.body);
    await reportAsset.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: reportAsset });
  } catch (error) {
    next(error);     
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { name, description, location } = req.body;
    const data = await ReportAsset.findByIdAndUpdate(id, { name, description, location }, { new: true });
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);     
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await ReportAsset.findById(id);
    if (!data) {
        const error = new Error("Data not found");
        (error as any).status = 404;
        throw error;
    }
    await ReportAsset.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);     
  }
};