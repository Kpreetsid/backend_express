import { readFile } from 'fs/promises';
import path from 'path';

export const getAllFeatures = async () => {
  const dataPath = path.join(__dirname, '../../public/features.json');
  const raw = await readFile(dataPath, 'utf-8');
  return JSON.parse(raw);
};