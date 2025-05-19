import express, { NextFunction, Request, Response } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './formCategory.service';

export const getFormCategories = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeFormCategory = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}