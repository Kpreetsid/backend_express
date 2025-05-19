import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './observation.service';

export const getObservations = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getObservation = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createObservation = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}