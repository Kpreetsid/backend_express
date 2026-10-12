import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { GUIDE_CATEGORIES, KnowledgeBaseGuideModel } from './knowledge-base.model';
import { guideFilesDirectory, resolveGuidePdf } from './knowledge-base.service';

export const MAX_GUIDE_PDF_SIZE = 20 * 1024 * 1024;
const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });
const unavailable = () => Object.assign(new Error('This guide is unavailable.'), { status: 404 });
const validId = (id: string) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) { throw unavailable(); }
  return new Types.ObjectId(id);
};
export function guideVisibility(value: unknown): boolean {
  if (value === true || value === 'true') { return true; }
  if (value === false || value === 'false') { return false; }
  throw badRequest('Choose draft or published visibility.');
}
export function guideInput(body: Record<string, unknown>) {
  const title = typeof body['title'] === 'string' ? body['title'].trim() : '';
  const description = typeof body['description'] === 'string' ? body['description'].trim() : '';
  const category = typeof body['category'] === 'string' ? body['category'] : '';
  if (!title || title.length > 180) { throw badRequest('Enter a title of up to 180 characters.'); }
  if (description.length > 600) { throw badRequest('The description must be 600 characters or fewer.'); }
  if (!GUIDE_CATEGORIES.some(item => item.id === category)) { throw badRequest('Choose a valid guide category.'); }
  return { title, description, category, published: guideVisibility(body['published'] ?? false) };
}
function expectedRevision(value: unknown): Date {
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) {
    throw badRequest('Reload this guide before saving changes.');
  }
  return new Date(value);
}
export function validateGuidePdf(file?: Express.Multer.File): Express.Multer.File {
  if (!file || !/\.pdf$/i.test(file.originalname) || !file.buffer?.length ||
      file.buffer.length > MAX_GUIDE_PDF_SIZE || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw badRequest('Select a valid PDF of up to 20 MB.');
  }
  return file;
}
async function storePdf(file: Express.Multer.File): Promise<string> {
  const root = guideFilesDirectory();
  await fs.mkdir(root, { recursive: true });
  const fileName = `${randomUUID()}.pdf`;
  await fs.writeFile(path.join(root, fileName), file.buffer, { flag: 'wx' });
  return fileName;
}
async function removePdf(fileName: string): Promise<void> {
  try { await fs.unlink(await resolveGuidePdf(fileName)); }
  catch (error) {
    if ((error as { status?: number }).status !== 404) {
      console.warn('Could not remove an unused knowledge-base PDF:', fileName);
    }
  }
}
export function publisherGuide(guide: any) {
  return { id: String(guide._id), title: guide.title, description: guide.description,
    category: guide.category, size: guide.size, published: guide.published,
    createdAt: guide.createdAt, updatedAt: guide.updatedAt };
}

export const guidePublishingService = {
  async list() {
    const guides = await KnowledgeBaseGuideModel.find({}).sort({ updatedAt: -1 }).lean().exec();
    return guides.map(publisherGuide);
  },
  async find(id: string) {
    const guide = await KnowledgeBaseGuideModel.findById(validId(id)).lean().exec();
    if (!guide) { throw unavailable(); }
    return guide;
  },
  async create(body: Record<string, unknown>, file: Express.Multer.File | undefined, publisherId: string) {
    const values = guideInput(body);
    const pdf = validateGuidePdf(file);
    const fileName = await storePdf(pdf);
    try {
      const guide = await KnowledgeBaseGuideModel.create({ ...values, fileName,
        size: pdf.buffer.length, createdByInternalUser: publisherId, updatedByInternalUser: publisherId });
      return publisherGuide(guide);
    } catch (error) { await removePdf(fileName); throw error; }
  },
  async update(id: string, body: Record<string, unknown>, file: Express.Multer.File | undefined, publisherId: string) {
    const values = guideInput(body);
    const revision = expectedRevision(body['updatedAt']);
    const current = await this.find(id);
    const pdf = file ? validateGuidePdf(file) : undefined;
    if (values.published && !pdf) { await resolveGuidePdf(current.fileName); }
    const fileName = pdf ? await storePdf(pdf) : undefined;
    let guide;
    try {
      guide = await KnowledgeBaseGuideModel.findOneAndUpdate({ _id: validId(id), updatedAt: revision }, {
        $set: { ...values, updatedByInternalUser: publisherId,
          ...(pdf ? { fileName, size: pdf.buffer.length } : {}) }
      }, { returnDocument: 'after', runValidators: true }).lean().exec();
      if (!guide) { throw Object.assign(new Error('This guide changed. Reload it before saving.'), { status: 409 }); }
    } catch (error) { if (fileName) { await removePdf(fileName); } throw error; }
    if (fileName) { await removePdf(current.fileName); }
    return publisherGuide(guide);
  },
  async remove(id: string, body: Record<string, unknown>) {
    const revision = expectedRevision(body['updatedAt']);
    await this.find(id);
    const guide = await KnowledgeBaseGuideModel.findOneAndDelete({ _id: validId(id), updatedAt: revision }).lean().exec();
    if (!guide) { throw Object.assign(new Error('This guide changed. Reload it before deleting.'), { status: 409 }); }
    await removePdf(guide.fileName);
  },
  async visibility(id: string, body: Record<string, unknown>, publisherId: string) {
    const published = guideVisibility(body['published']);
    const revision = expectedRevision(body['updatedAt']);
    const current = await this.find(id);
    if (published) { await resolveGuidePdf(current.fileName); }
    const guide = await KnowledgeBaseGuideModel.findOneAndUpdate({ _id: validId(id), updatedAt: revision }, {
      $set: { published, updatedByInternalUser: publisherId }
    }, { returnDocument: 'after', runValidators: true }).lean().exec();
    if (!guide) { throw Object.assign(new Error('This guide changed. Reload it before saving.'), { status: 409 }); }
    return publisherGuide(guide);
  }
};
