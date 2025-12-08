import * as crypto from "crypto";
 
const SHARED_SECRET =
    "$Pp5DJI7WnV7%OQC9%S*QmhcN3s7k%5fo%kHuj@F2RHQXzjTSyQW6fNnSXJv2uDjneRDAsra" +
    "C51tGS2aJD7q$SI2a4ca$A3DVeB@wPMPrWA8kmWRxa$5xkO598urS*2NWy9dgWr$XinOgWB2jWN7xh";
 
function getKey(): Buffer {
    return crypto.createHash("sha256").update(SHARED_SECRET).digest();
}
 
export function encryptToken(email: string, ttlSeconds: number = 300): string {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const now = Math.floor(Date.now() / 1000);
 
    const payload = {
        email,
        iat: now,
        exp: now + ttlSeconds,
    };
 
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
 
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
 
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
 
    const tokenStruct = {
        iv: iv.toString("base64"),
        ct: ct.toString("base64"),
        tag: tag.toString("base64"),
    };
 
    return Buffer.from(JSON.stringify(tokenStruct)).toString("base64");
}
 
export function decryptToken(token: string): any {
    const key = getKey();
 
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
 
    const iv = Buffer.from(decoded.iv, "base64");
    const ct = Buffer.from(decoded.ct, "base64");
    const tag = Buffer.from(decoded.tag, "base64");
 
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
 
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
 
    return JSON.parse(plaintext.toString("utf8"));
}
 
if (require.main === module) {
    const email = "abc@def.com";
 
    const encrypted = encryptToken(email);
    console.log("External Token:\n", encrypted, "\n");
 
    const decrypted = decryptToken(encrypted);
    console.log("Decrypted Payload:\n", decrypted, "\n");
 
    const now = Math.floor(Date.now() / 1000);
    console.log("Sanity Check:");
    console.log("Email:", decrypted.email);
    console.log("iat:", decrypted.iat, "exp:", decrypted.exp);
    console.log("Is expired:", decrypted.exp < now);
}