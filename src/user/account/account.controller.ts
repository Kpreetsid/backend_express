import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { companyService } from '../../masters/company/company.service';
import {
    getAccountApiKeyService,
    generateAccountApiKeyService,
    removeAccountApiKeyService
} from './account.service';

export const getAccountApiKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { accountId } = req.params;
        if (!accountId || !mongoose.Types.ObjectId.isValid(String(accountId))) {
            throw Object.assign(new Error('Invalid Account Id'), { status: 400 });
        }
        const verifyAccount = await companyService.verifyCompany(String(accountId));
        if (!verifyAccount) {
            throw Object.assign(new Error('No Record found with the given Account Id'), { status: 404 });
        }

        let accountApiKey = await getAccountApiKeyService(verifyAccount);
        if (!accountApiKey && (req.query.generate === 'true' || req.query.autoGenerate === 'true')) {
            accountApiKey = await generateAccountApiKeyService(verifyAccount);
        }
        if (!accountApiKey) {
            throw Object.assign(new Error('No API key found for the given Account Id'), { status: 404 });
        }

        return res.status(200).json({
            status: true,
            message: 'Account API key retrieved successfully',
            data: {
                account_id: verifyAccount._id,
                account_name: verifyAccount.account_name,
                download_api_key: accountApiKey,
                external_token: accountApiKey
            }
        });
    } catch (error) {
        next(error);
    }
};

export const generateAccountApiKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { accountId } = req.params;
        if (!accountId || !mongoose.Types.ObjectId.isValid(String(accountId))) {
            throw Object.assign(new Error('Invalid Account Id'), { status: 400 });
        }
        const verifyAccount = await companyService.verifyCompany(String(accountId));
        if (!verifyAccount) {
            throw Object.assign(new Error('No Record found with the given Account Id'), { status: 404 });
        }

        // If GET request without ?regenerate=true and key already exists, return existing key
        if (req.method === 'GET' && req.query.regenerate !== 'true' && verifyAccount.download_api_key) {
            return res.status(200).json({
                status: true,
                message: 'Account API key retrieved successfully',
                data: {
                    account_id: verifyAccount._id,
                    account_name: verifyAccount.account_name,
                    download_api_key: verifyAccount.download_api_key,
                    external_token: verifyAccount.download_api_key
                }
            });
        }

        const accountApiKey = await generateAccountApiKeyService(verifyAccount);
        if (!accountApiKey) {
            throw Object.assign(new Error('Failed to generate API Key with the given Account Id'), { status: 500 });
        }

        return res.status(200).json({
            status: true,
            message: 'Account API key generated successfully',
            data: {
                account_id: verifyAccount._id,
                account_name: verifyAccount.account_name,
                download_api_key: accountApiKey,
                external_token: accountApiKey
            }
        });
    } catch (error) {
        next(error);
    }
};

export const removeAccountApiKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { accountId } = req.params;
        if (!accountId || !mongoose.Types.ObjectId.isValid(String(accountId))) {
            throw Object.assign(new Error('Invalid Account Id'), { status: 400 });
        }
        const verifyAccount = await companyService.verifyCompany(String(accountId));
        if (!verifyAccount) {
            throw Object.assign(new Error('No Record found with the given Account Id'), { status: 404 });
        }
        if (!verifyAccount.download_api_key) {
            throw Object.assign(new Error('No API key exists for the given Account Id'), { status: 404 });
        }

        const removed = await removeAccountApiKeyService(verifyAccount);
        if (!removed) {
            throw Object.assign(new Error('Failed to remove API key for the given Account Id'), { status: 500 });
        }

        return res.status(200).json({
            status: true,
            message: 'Account API key removed successfully',
            data: {
                account_id: verifyAccount._id,
                account_name: verifyAccount.account_name
            }
        });
    } catch (error) {
        next(error);
    }
};