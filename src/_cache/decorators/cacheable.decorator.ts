/**
 * @Cacheable — Service-level read-through cache decorator.
 *
 * Usage:
 *   class AssetService {
 *     @Cacheable((args) => CacheKeys.assetList(args[0]), CacheTTL.ASSET_LIST)
 *     async getAllAssets(accountId: string) { ... }
 *   }
 *
 * The decorator intercepts the method call, checks Redis first, and on a miss
 * executes the original method and stores the result.
 *
 * Key resolver receives the method's arguments array.
 */

import { CacheManager } from '../cacheManager';

type KeyResolver = (args: any[]) => string | null;

/**
 * @Cacheable decorator factory.
 *
 * @param keyResolver - Function receiving the method args to produce a Redis key.
 *                      Return null to skip caching for that specific invocation.
 * @param ttlSeconds  - Cache duration in seconds.
 */
export function Cacheable(keyResolver: KeyResolver, ttlSeconds: number): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod: (...args: any[]) => Promise<any> = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyResolver(args);

      if (!key || !CacheManager.isAvailable()) {
        return originalMethod.apply(this, args);
      }

      const { value, hit } = await CacheManager.getOrSet(key, ttlSeconds, () =>
        originalMethod.apply(this, args)
      );

      if (process.env.NODE_ENV !== 'production') {
        console.log(`${hit ? 'GET' : 'SET'} data with key = ${key}`)
      }

      return value;
    };

    return descriptor;
  };
}
