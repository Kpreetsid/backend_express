import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './schedule.service';

export const getSchedules = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getSchedule = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createSchedule = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateSchedule = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeSchedule = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}