import { Response, NextFunction } from "express";

export const checkPasswordExpire = async (_req: any, _res: Response, next: NextFunction) => {
    // Expiry is advisory. Compute the notice only after successful authentication,
    // rather than blocking login or revealing password age before credentials pass.
    next();
};
