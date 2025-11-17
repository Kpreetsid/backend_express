import express from 'express';
import { getAll } from './features.controller';

export default (router: express.Router) => {
    const featuresRouter = express.Router();
    featuresRouter.get('/', getAll);
    router.use('/features', featuresRouter);
}