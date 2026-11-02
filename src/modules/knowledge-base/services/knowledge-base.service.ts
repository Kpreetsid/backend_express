import fs from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { KnowledgeBaseGuide, KnowledgeBaseGuideModel } from '../models/knowledge-base.model';

export const guideFilesDirectory = (): string => path.resolve(path.join(__dirname, '../../../../uploadFiles/knowledge_base'));

const unavailable = (): Error => Object.assign(new Error('This guide is unavailable.'), { status: 404 });

export async function resolveGuidePdf(fileName: string, root = guideFilesDirectory()): Promise<string> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/i.test(fileName)) {
    throw unavailable();
  }
  try {
    const [realRoot, realFile] = await Promise.all([
      fs.realpath(root), fs.realpath(path.join(root, fileName))
    ]);
    if (!realFile.startsWith(realRoot + path.sep)) { throw unavailable(); }
    const stats = await fs.stat(realFile);
    if (!stats.isFile()) { throw unavailable(); }
    const file = await fs.open(realFile, 'r');
    try {
      const signature = Buffer.alloc(5);
      await file.read(signature, 0, 5, 0);
      if (signature.toString('ascii') !== '%PDF-') { throw unavailable(); }
    } finally {
      await file.close();
    }
    return realFile;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(code || '')) { throw unavailable(); }
    throw error;
  }
}

export const knowledgeBaseService = {
  async listGuides() {
    const guides = await KnowledgeBaseGuideModel.find({ published: true })
      .select('_id title description category size updatedAt').sort({ title: 1 }).lean().exec();
    return guides.map(guide => ({
      id: String(guide._id), title: guide.title, description: guide.description,
      category: guide.category, size: guide.size, updatedAt: guide.updatedAt
    }));
  },

  async findPublishedGuide(id: string): Promise<KnowledgeBaseGuide> {
    if (!/^[a-f0-9]{24}$/i.test(id)) { throw unavailable(); }
    const guide = await KnowledgeBaseGuideModel.findOne({
      _id: new Types.ObjectId(id), published: true
    }).lean().exec();
    if (!guide) { throw unavailable(); }
    return guide;
  }
};
