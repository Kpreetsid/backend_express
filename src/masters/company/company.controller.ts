import express, { NextFunction, Request, Response } from 'express';
import { getAll, getDataById, updateById, removeById } from './company.service';

export const getCompanies = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getCompany = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeCompany = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}