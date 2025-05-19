import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './request.service';

export const getRequests = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getRequest = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createRequest = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateRequest = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeRequest = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}