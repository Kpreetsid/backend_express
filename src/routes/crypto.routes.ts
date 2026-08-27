import { Router, Request, Response, NextFunction } from 'express';
import { payloadCryptoService } from '../_config/payloadCrypto';

export const cryptoRouter = Router();

cryptoRouter.get('/bootstrap', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!payloadCryptoService.isEnabled()) {
      res.status(200).json({
        status: false,
        message: 'Payload crypto is disabled',
        data: { enabled: false }
      });
      return;
    }

    const clientPublicKey = readCryptoParam(req.query.clientPublicKey || req.headers['x-cmms-client-public-key']);
    const clientNonce = readCryptoParam(req.query.clientNonce || req.headers['x-cmms-client-nonce']);
    const data = payloadCryptoService.createBootstrapSession(clientPublicKey, clientNonce);
    res.status(200).json({ status: true, message: 'Payload crypto bootstrap created', data });
  } catch (error) {
    next(error);
  }
});

function readCryptoParam(value: unknown): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return String(rawValue || '').trim().replace(/ /g, '+');
}
