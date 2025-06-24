import express, { NextFunction, Request, Response } from 'express';
import { getAll, getDataById, insert, updateById, removeById, getCoordinates, floorMapAssetCoordinates, insertCoordinates } from './floorMap.service';

export const getFloorMaps = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeFloorMap = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}

export const getFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await getCoordinates(req, res, next);
}

export const getFloorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await floorMapAssetCoordinates(req, res, next);
}

export const setFloorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  await insertCoordinates(req, res, next);
}