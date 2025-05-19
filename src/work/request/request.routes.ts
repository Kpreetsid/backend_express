import express from 'express';
import { authenticateJwt } from '../../_config/auth';
import { getRequests, getRequest, createRequest, updateRequest, removeRequest } from './request.controller';

export default (router: express.Router) => {
    router.get('/requests', getRequests);
    router.get('/request/:id', getRequest);
    router.post('/request', createRequest);
    router.put('/request/:id', updateRequest);
    router.delete('/request/:id', removeRequest);
}