import express from 'express';
import { getRequests, getRequest, createRequest, updateRequest, removeRequest } from './request.controller';
import { hasPermission } from '../../_config/permission';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', getRequests);
    requestRouter.get('/:id', getRequest);
    requestRouter.post('/', createRequest);
    requestRouter.put('/:id', updateRequest);
    requestRouter.delete('/:id', hasPermission('admin'),removeRequest);
    router.use('/requests', requestRouter);
}