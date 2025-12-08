import { Request, Response, NextFunction } from "express";
import { decryptToken } from "../auth";

export function verifyEncryptedToken(req: Request, res: Response, next: NextFunction): void {
    try {
        const token = req.body.external_token;
        if (!token || typeof token !== "string") {
            res.status(401).json({ error: "Token missing in body" });
            return;
        }
        const payload = decryptToken(token);
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid or tampered token" });
        return;
    }
}