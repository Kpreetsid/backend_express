import { UserToken, IUserToken } from "../_models/userToken.model";
import { Request, Response, NextFunction } from 'express';

// export const getAllUserTokens = async (): Promise<IUserToken[]> => {
//     return await UserToken.find();
// };

export const createUserToken = async (
  data: IUserToken
): Promise<IUserToken> => {
  return await UserToken.create(data);
};
 
export const getAllUserTokens = async (req: Request, res: Response, next: NextFunction): Promise<IUserToken[]> => {
  try {
    return await UserToken.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};