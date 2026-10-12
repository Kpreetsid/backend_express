import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { GUIDE_CATEGORIES } from './knowledge-base.model';
import { requireGuidePublisher, requireGuidePermission, GuidePublisherRequest } from './knowledge-base.publisher-auth';
import { guidePublishingService, MAX_GUIDE_PDF_SIZE } from './knowledge-base.publishing.service';
import { resolveGuidePdf } from './knowledge-base.service';
import { rateLimiter } from '../middlewares/rateLimits';

const multipart = multer({ storage: multer.memoryStorage(), limits: {
  files: 1, fileSize: MAX_GUIDE_PDF_SIZE, fields: 6, fieldSize: 2048
} }).single('file');
const upload: RequestHandler = (req, res, next) => multipart(req, res, error => {
  if (error instanceof multer.MulterError) {
    next(Object.assign(new Error(error.code === 'LIMIT_FILE_SIZE'
      ? 'Select a valid PDF of up to 20 MB.' : 'Upload one PDF with valid guide details.'), { status: 400 }));
    return;
  }
  next(error);
});

export const guidePublishingRoutes = (): Router => {
  const router = Router();
  router.use(requireGuidePublisher, requireGuidePermission('view'));
  router.get('/guides', async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ status: true, data: { guides: await guidePublishingService.list(), categories: GUIDE_CATEGORIES, permissions: (req as GuidePublisherRequest).guidePublisher!.permissions } });
    } catch (error) { next(error); }
  });
  router.get('/guides/:id/file', async (req, res, next) => {
    try {
      const guide = await guidePublishingService.find(String(req.params.id));
      const file = await resolveGuidePdf(guide.fileName);
      res.type('application/pdf');
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(file, error => { if (error) { next(error); } });
    } catch (error) { next(error); }
  });
  router.post('/guides', requireGuidePermission('add'), rateLimiter.uploadLimiter, upload, async (req, res, next) => {
    try {
      const publisherId = (req as GuidePublisherRequest).guidePublisher!.id;
      const guide = await guidePublishingService.create(req.body || {}, req.file, publisherId);
      res.status(201).json({ status: true, data: guide });
    } catch (error) { next(error); }
  });
  router.put('/guides/:id', requireGuidePermission('edit'), rateLimiter.uploadLimiter, upload, async (req, res, next) => {
    try {
      const publisherId = (req as GuidePublisherRequest).guidePublisher!.id;
      const guide = await guidePublishingService.update(String(req.params.id), req.body || {}, req.file, publisherId);
      res.json({ status: true, data: guide });
    } catch (error) { next(error); }
  });
  router.patch('/guides/:id/visibility', requireGuidePermission('edit'), async (req, res, next) => {
    try {
      const publisherId = (req as GuidePublisherRequest).guidePublisher!.id;
      const guide = await guidePublishingService.visibility(String(req.params.id), req.body || {}, publisherId);
      res.json({ status: true, data: guide });
    } catch (error) { next(error); }
  });
  router.delete('/guides/:id', requireGuidePermission('delete'), async (req, res, next) => {
    try {
      await guidePublishingService.remove(String(req.params.id), req.body || {});
      res.json({ status: true, message: 'Guide deleted.' });
    } catch (error) { next(error); }
  });
  return router;
};
