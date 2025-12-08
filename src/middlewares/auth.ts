import { Request, Response, NextFunction } from "express";
import { decryptToken } from "../auth";
 
export function verifyEncryptedToken(req: Request, res: Response, next: NextFunction): void {
    try {
        const token = req.headers["x-auth-token"];
 
        if (!token || typeof token !== "string") {
            res.status(401).json({ error: "Token missing" });
            return;
        }
 
        const payload = decryptToken(token);
 
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
 
        (req as any).user = payload; // attach decrypted data
        next(); // allow to continue
    } catch (err) {
        res.status(401).json({ error: "Invalid or tampered token" });
        return;
    }
}