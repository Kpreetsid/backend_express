import express from 'express';
import { userTokenController } from '../controllers/userToken.controller';

export default (router: express.Router) => {
    router.get('/users/:token', userTokenController.getUserByToken);
}