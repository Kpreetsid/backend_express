import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './sops.service';

export const getSops = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getSop = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createSop = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateSop = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeSop = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}