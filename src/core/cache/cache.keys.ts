/**
 * CacheKeys — Centralized, human-readable, multi-tenant Redis key patterns.
 *
 * Pattern: cmms:{env}:{accountId}:{entity}:{id}
 * Example:  cmms:production:acc123:asset:asset456
 *
 * Keys are environment-isolated, tenant-isolated, and human-readable for easy
 * debugging via redis-cli.
 */

const ENV = process.env.NODE_ENV || 'development';

export const CacheKeys = {
  /* ─────────── MASTERS ─────────── */
  asset:              (accountId: string, id: string) => `cmms:${ENV}:${accountId}:asset:${id}`,
  assetList:          (accountId: string)             => `cmms:${ENV}:${accountId}:asset:list`,
  assetListQuery:     (accountId: string, queryHash: string) => `cmms:${ENV}:${accountId}:asset:list:query:${queryHash}`,

  location:           (accountId: string, id: string) => `cmms:${ENV}:${accountId}:location:${id}`,
  locationList:       (accountId: string)             => `cmms:${ENV}:${accountId}:location:list`,

  user:               (accountId: string, id: string) => `cmms:${ENV}:${accountId}:user:${id}`,
  userList:           (accountId: string)             => `cmms:${ENV}:${accountId}:user:list`,

  role:               (accountId: string)             => `cmms:${ENV}:${accountId}:role:list`,

  part:               (accountId: string, id: string) => `cmms:${ENV}:${accountId}:part:${id}`,
  partList:           (accountId: string)             => `cmms:${ENV}:${accountId}:part:list`,

  equipment:          (accountId: string, id: string) => `cmms:${ENV}:${accountId}:equipment:${id}`,
  equipmentList:      (accountId: string)             => `cmms:${ENV}:${accountId}:equipment:list`,

  sops:               (accountId: string, id: string) => `cmms:${ENV}:${accountId}:sops:${id}`,
  sopsList:           (accountId: string)             => `cmms:${ENV}:${accountId}:sops:list`,

  formCategory:       (accountId: string)             => `cmms:${ENV}:${accountId}:formCategory:list`,
  inspection:         (accountId: string)             => `cmms:${ENV}:${accountId}:inspection:list`,
  observation:        (accountId: string)             => `cmms:${ENV}:${accountId}:observation:list`,
  troubleshootGuide:  (accountId: string)             => `cmms:${ENV}:${accountId}:troubleshootGuide:list`,
  floorMap:           (accountId: string)             => `cmms:${ENV}:${accountId}:floorMap:list`,
  schedule:           (accountId: string)             => `cmms:${ENV}:${accountId}:schedule:list`,

  /* ─────────── WORK ─────────── */
  workOrder:          (accountId: string, id: string) => `cmms:${ENV}:${accountId}:workOrder:${id}`,
  workOrderList:      (accountId: string)             => `cmms:${ENV}:${accountId}:workOrder:list`,
  workOrderDashboard: (accountId: string)             => `cmms:${ENV}:${accountId}:workOrder:dashboard`,

  workRequest:        (accountId: string, id: string) => `cmms:${ENV}:${accountId}:workRequest:${id}`,
  workRequestList:    (accountId: string)             => `cmms:${ENV}:${accountId}:workRequest:list`,

  workTemplate:       (accountId: string, id: string) => `cmms:${ENV}:${accountId}:workTemplate:${id}`,
  workTemplateList:   (accountId: string)             => `cmms:${ENV}:${accountId}:workTemplate:list`,

  procedure:          (accountId: string, id: string) => `cmms:${ENV}:${accountId}:procedure:${id}`,
  procedureList:      (accountId: string)             => `cmms:${ENV}:${accountId}:procedure:list`,

  instruction:        (accountId: string, id: string) => `cmms:${ENV}:${accountId}:instruction:${id}`,
  instructionList:    (accountId: string)             => `cmms:${ENV}:${accountId}:instruction:list`,

  /* ─────────── MAPPINGS ─────────── */
  userAssetMapping:   (userId: string)               => `cmms:${ENV}:${userId}:mapping:asset`,
  userLocationMapping:(userId: string)               => `cmms:${ENV}:${userId}:mapping:location`,

  /* ─────────── REPORTS ─────────── */
  report:             (accountId: string, assetId: string) => `cmms:${ENV}:${accountId}:report:${assetId}`,
  reportList:         (accountId: string)             => `cmms:${ENV}:${accountId}:report:list`,

  /* ─────────── NOTIFICATIONS ─────────── */
  notificationList:   (userId: string)               => `cmms:${ENV}:${userId}:notification:list`,

  /* ─────────── SETTINGS ─────────── */
  settings:           (accountId: string)             => `cmms:${ENV}:${accountId}:settings`,

  /* ─────────── SECURITY (no env prefix — global blacklist) ─────────── */
  jwtBlacklist:       (jti: string)                   => `cmms:blacklist:${jti}`,
  otp:                (email: string)                 => `cmms:otp:${email}`,
  passwordReset:      (email: string)                 => `cmms:reset:${email}`,
} as const;

/** TTL constants (in seconds) for each cache category */
export const CacheTTL = {
  ASSET_DETAIL:        15 * 60,   // 15 min
  ASSET_LIST:           5 * 60,   //  5 min
  LOCATION_DETAIL:     15 * 60,   // 15 min
  LOCATION_LIST:        5 * 60,   //  5 min
  USER_DETAIL:         30 * 60,   // 30 min
  USER_LIST:           10 * 60,   // 10 min
  ROLE_LIST:           60 * 60,   //  1 hr
  PART_LIST:           30 * 60,   // 30 min
  WORK_ORDER_DETAIL:    2 * 60,   //  2 min
  WORK_ORDER_LIST:      2 * 60,   //  2 min
  WORK_ORDER_DASHBOARD: 60,       //  1 min
  WORK_REQUEST_LIST:    5 * 60,   //  5 min
  WORK_TEMPLATE:       30 * 60,   // 30 min
  PROCEDURE:           15 * 60,   // 15 min
  INSTRUCTION:         15 * 60,   // 15 min
  SCHEDULE_LIST:       10 * 60,   // 10 min
  EQUIPMENT_LIST:      30 * 60,   // 30 min
  SOPS_LIST:           30 * 60,   // 30 min
  MISC_LIST:           15 * 60,   // 15 min
  REPORT:              10 * 60,   // 10 min
  NOTIFICATION:              30,  // 30 sec
  SETTINGS:        24 * 60 * 60,  // 24 hr
  OTP:                  5 * 60,   //  5 min
  PASSWORD_RESET:      15 * 60,   // 15 min
  USER_ASSET_MAPPING:   5 * 60,   //  5 min
  USER_LOCATION_MAPPING:5 * 60,   //  5 min
} as const;
