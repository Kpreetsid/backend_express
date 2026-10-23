import { Request } from 'express';
import { getRequestAccountId } from '../../modules/settings/services/redis-status.service';
import { RedisUtils } from './redis.utils';
import { __controllerCacheTestUtils } from './controller-cache.service';

import crypto from 'crypto';

/**
 * Recursively standardizes and hashes an object into a distinct cache string.
 */
export const generateDeterministicObjectKey = (obj: any): string => {
  if (!obj) return 'empty';
  
  const stableStringify = (value: any): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  };

  const str = stableStringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
};

/**
 * Generates a deterministic URL string from the request's originalUrl.
 * It parses the URL, sorts the query string parameters alphabetically,
 * and reconstructs the URL. This guarantees that requests with identically
 * matched but differently ordered query parameters (e.g. ?a=1&b=2 vs ?b=2&a=1)
 * map to the exact same cache key.
 */
export const generateDeterministicUrl = (originalUrl: string): string => {
  if (!originalUrl || !originalUrl.includes('?')) {
    return originalUrl || '';
  }

  try {
    const [path, queryString] = originalUrl.split('?');
    if (!queryString) {
      return path;
    }

    const params = new URLSearchParams(queryString);
    
    // Convert to array of key-value pairs and sort alphabetically by key
    const sortedParams = Array.from(params.entries()).sort(([keyA], [keyB]) => {
      return keyA.localeCompare(keyB);
    });

    const deterministicQuery = new URLSearchParams(sortedParams).toString();
    return deterministicQuery ? `${path}?${deterministicQuery}` : path;
  } catch (error) {
    // Fallback to original url in case of any parsing failure
    return originalUrl;
  }
};

/**
 * Purges an entire cache family immediately.
 * This utilizes the tag tracking system defined in the controllerCache.
 * 
 * @param req The Express request triggering the invalidation
 * @param family The cache family (e.g., 'users', 'assets') to invalidate
 */
export const invalidateCacheFamily = async (req: Request, family: string): Promise<void> => {
  const accountId = getRequestAccountId(req);
  if (!accountId) {
    return;
  }
  
  // Use the exact tagging format built in controllerCache
  const tagKey = __controllerCacheTestUtils.buildTagKey(accountId, family);
  const keys = await RedisUtils.getSet<string>(tagKey);
  
  if (keys && keys.length > 0) {
    await RedisUtils.deleteMany(keys);
  }
  await RedisUtils.delete(tagKey);
};
