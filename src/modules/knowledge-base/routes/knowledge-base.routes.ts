import { Router } from 'express';
import { GUIDE_CATEGORIES } from '@modules/knowledge-base/models/knowledge-base.model';
import { knowledgeBaseService, resolveGuidePdf } from '@modules/knowledge-base/services/knowledge-base.service';

/** Mount behind isAuthenticated; viewing is available to every application user. */
export const knowledgeBaseRoutes = (): Router => {
  const router = Router();
  router.get('/guides', async (_req, res, next) => {
    try {
      const guides = await knowledgeBaseService.listGuides();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ status: true, data: { guides, categories: GUIDE_CATEGORIES } });
    } catch (error) { next(error); }
  });
  router.get('/guides/:id/file', async (req, res, next) => {
    try {
      const guide = await knowledgeBaseService.findPublishedGuide(String(req.params.id));
      const file = await resolveGuidePdf(guide.fileName);
      const title = guide.title.replace(/[\x00-\x1f\x7f\/\\]/g, '_').trim() || 'Guide';
      res.attachment(`${title}.pdf`);
      if (req.query.download !== '1') {
        res.setHeader('Content-Disposition', String(res.getHeader('Content-Disposition')).replace(/^attachment/, 'inline'));
      }
      res.type('application/pdf');
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(file, error => { if (error) { next(error); } });
    } catch (error) { next(error); }
  });
  // There are deliberately no publishing, upload, update or delete endpoints.
  return router;
};
