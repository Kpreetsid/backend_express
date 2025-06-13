import express, { NextFunction, Request, Response } from 'express';
import { getAll, getDataById, insert, updateById, removeById, floorMapCoordinates } from './floorMap.service';

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
  await floorMapCoordinates(req, res, next);
}