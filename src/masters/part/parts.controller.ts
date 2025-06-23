import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './parts.service';

export const getParts = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getPart = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createPart = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updatePart = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removePart = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}