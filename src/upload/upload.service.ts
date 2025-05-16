import { Request, Response, NextFunction } from 'express';

export const uploadService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const files: any = req.files;
        if (!req.files || req.files.length === 0) {
            throw Object.assign(new Error('No files uploaded'), { status: 400 });
        }
        const data = files.map((file: any) => {
            return {
                "originalName": file.originalname,
                "type": file.mimetype,
                "destination": file.destination,
                "fileName": file.filename,
                "fileUrl": `${req.protocol}://${req.get('host')}/${file.filename}`,
                "filePath": file.path,
                "size": file.size
            }
        });
        return res.status(200).send({ status: true, message: 'Files uploaded successfully', data });
    } catch (err) {
        console.error(err);
        next(err);
    }
};