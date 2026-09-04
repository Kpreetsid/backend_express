import { EventEmitter } from 'events';

/**
 * Global Event Emitter for decoupling business logic from side effects like notifications.
 */
export const globalEmitter = new EventEmitter();

export const Events = {
  NOTIFICATION_CREATED: 'notification_created',
  USER_STATUS_CHANGED: 'user_status_changed',
  ASSET_UPDATE: 'asset_update',
  WORK_ORDER_UPDATE: 'work_order_update',
  LOCATION_CREATED: 'location_created',
  LOCATION_UPDATED: 'location_updated',
};
