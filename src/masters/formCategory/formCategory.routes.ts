import express from 'express';
import { authenticateJwt } from '../../_config/auth';
import { getFormCategories, getFormCategory, createFormCategory, updateFormCategory, removeFormCategory } from './formCategory.controller';

export default (router: express.Router) => {
    router.get('/formCategories', getFormCategories);
    router.get('/formCategory/:id', getFormCategory);
    router.post('/formCategory', createFormCategory);
    router.put('/formCategory/:id', updateFormCategory);
    router.delete('/formCategory/:id', removeFormCategory);
}