import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, getDataByFilter, insert, updateById, removeById } from './order.service';

export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const getFilterOrders = async (req: Request, res: Response, next: NextFunction) => {
  await getDataByFilter(req, res, next);
}

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateOrder = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeOrder = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}