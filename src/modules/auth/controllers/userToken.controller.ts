import { Request, Response, NextFunction } from 'express';
import { userTokenService } from '../services/userToken.service';

class UserTokenController {
  async getUserByToken (req: Request, res: Response, next: NextFunction): Promise<any> {
    await userTokenService.getAllUserTokens(req, res, next);
  };
}

export const userTokenController = new UserTokenController();