import express from 'express';

import { getUserByToken } from './userToken.controller';

export default (router: express.Router) => {
    router.get('/users/:token', getUserByToken);
}