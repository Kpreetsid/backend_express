import { Request, Response, NextFunction } from 'express';
import { getAllRequests, getRequestById, createRequest, updateRequest, deleteRequestById } from './request.service';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAllRequests(req, res, next);
}

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getRequestById(req, res, next);
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await createRequest(req, res, next);
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await updateRequest(req, res, next);
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await deleteRequestById(req, res, next);
}