import { Response, NextFunction } from "express";
import { usersService } from "../masters/user/user.service";

export const checkPasswordExpire = async (req: any, res: Response, next: NextFunction) => {
    try {
        const match = { username: req.body.username, user_status: "active" };
        const userData = await usersService.getUserDetails(match);

        if (userData && userData.passwordExpiredAt) {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const passwordUpdateDate = new Date(userData.passwordExpiredAt);

            if (passwordUpdateDate < threeMonthsAgo) {
                throw Object.assign(new Error("Your password has expired. Please reset your password to continue."), { status: 403 });
            }
        }
        next();
    } catch (error) {
        next(error);
    }
};
