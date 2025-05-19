import express from 'express';

import { userRegister } from './registration.controller';

export default (router: express.Router) => {
    router.post('/registration', userRegister);
}