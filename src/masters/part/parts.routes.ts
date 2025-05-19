import express from 'express';
import { getParts, getPart, createPart, updatePart, removePart } from './parts.controller';

export default (router: express.Router) => {
    router.get('/parts', getParts);
    router.get('/part/:id', getPart);
    router.post('/part', createPart);
    router.put('/part/:id', updatePart);
    router.delete('/part/:id', removePart);
}