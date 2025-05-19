import express from 'express';
import { authenticateJwt } from '../../_config/auth';
import { getCompanies, getCompany, updateCompany, removeCompany } from './company.controller';

export default (router: express.Router) => {
    router.get('/companies', getCompanies);
    router.get('/company/:id', getCompany);
    router.put('/company/:id', updateCompany);
    router.delete('/company/:id', removeCompany);
}