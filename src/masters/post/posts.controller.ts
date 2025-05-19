import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './posts.service';

export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getPost = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  await insert(req, res, next);
}

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removePost = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}