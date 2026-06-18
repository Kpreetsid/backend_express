import { Router, Request, Response, NextFunction } from 'express';
import { payloadCryptoService } from '../_config/payloadCrypto';

export const cryptoRouter = Router();

cryptoRouter.get('/bootstrap', (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientPublicKey = String(req.query.clientPublicKey || req.headers['x-cmms-client-public-key'] || '');
    const clientNonce = String(req.query.clientNonce || req.headers['x-cmms-client-nonce'] || '');
    const data = payloadCryptoService.createBootstrapSession(clientPublicKey, clientNonce);
    res.status(200).json({ status: true, message: 'Payload crypto bootstrap created', data });
  } catch (error) {
    next(error);
  }
});
