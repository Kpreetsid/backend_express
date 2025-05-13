import { Asset, IAsset } from "../../_models/asset.model";
import { NextFunction, Request, Response } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = req.user;
    const data: IAsset[] | null = await Asset.find({account_id: account_id}).sort({ _id: -1 }); 
    if (!data || data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findById(id);
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getAssetsTreeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, locations } = req.body;
    console.log(req.body);
    if (!accountId) {
      const error = new Error("Missing accountId");
      (error as any).status = 403;
      throw error;
    }
    const query: any = {
      account_id: accountId,
      visible: true,
      parent_id: { $in: [null, undefined] }
    };

    if (locations && Array.isArray(locations) && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    console.log(query);
    const rootAssets = await Asset.find(query);
    const data = await Promise.all(rootAssets.map(async (asset) => {
      return {
        ...asset.toObject(),
        children: await getRecursiveAssets(asset)
      };
    }));
    if (!data || data.length === 0) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

async function getRecursiveAssets(asset: any) {
  const children = await Asset.find({
    parent_id: asset._id,
    visible: true
  });

  const withChildren: any = await Promise.all(children.map(async (child: any) => {
    return {
      ...child.toObject(),
      children: await getRecursiveAssets(child)
    };
  }));

  return withChildren;
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newAsset = new Asset(req.body);
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
    const data = await Asset.findByIdAndUpdate(id, req.body, { new: true });
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
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
    const data = await Asset.findById(id);
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    if (!data?.visible) {
      const error = new Error("Data already deleted");
      (error as any).status = 400;
      throw error;
    }
    await Asset.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};