/**
 * @CacheEvict — Service-level cache invalidation decorator.
 *
 * Used as a fallback for write operations when CDC (Change Streams) is
 * unavailable (e.g., MongoDB standalone without Replica Set).
 *
 * Usage:
 *   class AssetService {
 *     @CacheEvict((args) => [CacheKeys.assetList(args[2]), CacheKeys.asset(args[2], args[0])])
 *     async updateAsset(id: string, body: any, accountId: string) { ... }
 *   }
 *
 * The decorator executes the original method first, and only if it succeeds
 * (i.e., does not throw) it invalidates the specified keys.
 */

import { CacheManager } from '../cache.manager';

type KeysResolver = (args: any[], result: any) => (string | null | undefined)[];

/**
 * @CacheEvict decorator factory.
 *
 * @param keysResolver - Function receiving (args, result) to produce an array of Redis keys to delete.
 *                       Null/undefined entries are safely ignored.
 */
export function CacheEvict(keysResolver: KeysResolver): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod: (...args: any[]) => Promise<any> = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      if (CacheManager.isAvailable()) {
        const rawKeys = keysResolver(args, result);
        const keys = rawKeys.filter((k): k is string => typeof k === 'string' && k.length > 0);
        if (keys.length > 0) {
          void CacheManager.del(...keys);
          if (process.env.NODE_ENV !== 'production') {
            console.debug(`[CacheEvict] Invalidating keys:`, keys);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}
