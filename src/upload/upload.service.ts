import { Request, Response, NextFunction } from 'express';

export const uploadService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const files: any = req.files;
        const { folderName } = req.params;
        if (!req.files || req.files.length === 0) {
            throw Object.assign(new Error('No files uploaded'), { status: 400 });
        }
        const data = files.map((file: any) => {
            let fileURL = `${req.protocol}://${req.get('host')}/${file.filename}`;
            if(folderName) {
                fileURL = `${req.protocol}://${req.get('host')}/${folderName}/${file.filename}`;
            }
            return {
                "originalName": file.originalname,
                "type": file.mimetype,
                "destination": file.destination,
                "fileName": file.filename,
                "fileUrl": fileURL,
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