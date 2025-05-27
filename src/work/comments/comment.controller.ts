import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, getDataByFilter, insert, updateById, removeById } from './comment.service';

export const getComments = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getComment = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const getFilterComments = async (req: Request, res: Response, next: NextFunction) => {
  await getDataByFilter(req, res, next);
}

export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeComment = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}