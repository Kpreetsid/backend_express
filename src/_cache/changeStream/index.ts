/**
 * CDC Change Stream Registry
 *
 * Entry point for all MongoDB Change Stream listeners.
 * Call `initChangeStreams(mongoose.connection)` once after database connects.
 *
 * IMPORTANT: Requires MongoDB Replica Set.
 * In standalone mode, streams are silently skipped and the
 * @CacheEvict fallback on service methods handles invalidation.
 */

import mongoose from 'mongoose';
import { cacheConfig } from '../../configDB';
import { watchAssets } from './asset.stream';
import { watchLocations } from './location.stream';
import { watchUsers } from './user.stream';
import { watchWorkOrders } from './workOrder.stream';
import { watchNotifications } from './notification.stream';
import { watchSchedules } from './schedule.stream';
import { watchParts } from './part.stream';
import { watchRoles } from './role.stream';
import { watchMappings } from './mapping.stream';

export const initChangeStreams = async (connection: mongoose.Connection): Promise<void> => {
  if (!cacheConfig.changeStreamsEnabled) {
    console.log('[CDC] MongoDB Change Streams disabled by CACHE_CHANGE_STREAMS_ENABLED=false');
    return;
  }

  if (!connection) {
    console.warn('[CDC] No mongoose connection provided — skipping change streams');
    return;
  }

  // Check if we are running in a Replica Set before initializing
  try {
    const adminDb = connection.db?.admin();
    if (adminDb) {
      const hello = await adminDb.command({ hello: 1 });
      if (!hello.setName) {
        console.warn('⚠️ [CDC] MongoDB is running in standalone mode. Change Streams disabled.');
        console.warn('   (Cache invalidation will rely on @CacheEvict fallbacks or TTLs)');
        return;
      }
    } else {
      console.warn('⚠️ [CDC] Could not access admin DB to verify Replica Set. Assuming standalone.');
      return;
    }
  } catch (err) {
    console.warn(`⚠️ [CDC] Could not verify Replica Set status (${(err as Error).message}). Skipping change streams.`);
    return;
  }

  // Replica Set is confirmed; initialize streams
  console.log('🔄 [CDC] Initializing MongoDB Change Streams...');

  watchAssets(connection);
  watchLocations(connection);
  watchUsers(connection);
  watchWorkOrders(connection);
  watchNotifications(connection);
  watchSchedules(connection);
  watchParts(connection);
  watchRoles(connection);
  watchMappings(connection);

  console.log('✅ [CDC] All change streams registered');
};

export {
  watchAssets,
  watchLocations,
  watchUsers,
  watchWorkOrders,
  watchNotifications,
  watchSchedules,
  watchParts,
  watchRoles,
  watchMappings,
};
