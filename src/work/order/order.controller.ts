import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, orderStatus, orderPriority } from './order.service';

export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
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

export const getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  await orderStatus(req, res, next);
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction) => {
  await orderPriority(req, res, next);
}