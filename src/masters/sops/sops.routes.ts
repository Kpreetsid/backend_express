import express from 'express';
import { getSops, getSop, createSop, updateSop, removeSop } from './sops.controller';

export default (router: express.Router) => {
    router.get('/sops', getSops);
    router.get('/sop/:id', getSop);
    router.post('/sop', createSop);
    router.put('/sop/:id', updateSop);
    router.delete('/sop/:id', removeSop);
}