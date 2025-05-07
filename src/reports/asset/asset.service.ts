import { ReportAsset, IReportAsset } from "../../_models/assetReport.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ReportAsset.find({}).sort({ _id: -1 });
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
    const { name, description, location } = req.body;
    const reportAsset = new ReportAsset({ name, description, location });
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
    const data = await ReportAsset.findByIdAndDelete(id);
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data deleted successfully", data });
  } catch (error) {
    next(error);     
  }
};