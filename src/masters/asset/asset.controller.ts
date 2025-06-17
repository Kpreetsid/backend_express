import express, { NextFunction, Request, Response } from 'express';
import { getAll, getDataById, insert, updateById, removeById, getAssetsTreeData, getAssetsFilteredData } from './asset.service';

export const getAssets = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getAssetTree = async (req: Request, res: Response, next: NextFunction) => {
  await getAssetsTreeData(req, res, next);
}

export const getFilteredAssets = async (req: Request, res: Response, next: NextFunction) => {
  await getAssetsFilteredData(req, res, next);
}

export const getAsset = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateAsset = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeAsset = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}