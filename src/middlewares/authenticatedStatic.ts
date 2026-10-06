import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '../_config/auth';

const isInside = (root: string, candidate: string): boolean => (
  candidate === root || candidate.startsWith(`${root}${path.sep}`)
);

/**
 * Serves files from disk only after the normal API authentication succeeds.
 *
 * Authentication is intentionally delayed until a real file has been found.
 * This lets the middleware be mounted at `/` for legacy upload URLs without
 * intercepting unrelated routes such as `/api/users/login`.
 */
export const authenticatedStatic = (rootDirectory: string): RequestHandler => {
  const root = path.resolve(rootDirectory);
  const serveStatic = express.static(root, { fallthrough: true });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    let relativePath: string;
    try {
      relativePath = decodeURIComponent(req.path).replace(/^[/\\]+/, '');
    } catch {
      next();
      return;
    }

    const candidate = path.resolve(root, relativePath);
    if (!relativePath || !isInside(root, candidate)) {
      next();
      return;
    }

    try {
      const [fileStats, realRoot, realCandidate] = await Promise.all([
        fs.promises.stat(candidate),
        fs.promises.realpath(root),
        fs.promises.realpath(candidate)
      ]);

      if (!fileStats.isFile() || !isInside(realRoot, realCandidate)) {
        next();
        return;
      }
    } catch {
      // It is not a static file under this mount; allow the next route to try.
      next();
      return;
    }

    isAuthenticated(req, res, (authenticationError?: unknown) => {
      if (authenticationError) {
        next(authenticationError);
        return;
      }
      serveStatic(req, res, next);
    });
  };
};
