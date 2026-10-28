export const buildAssetReportScope = (accountId: any, reportId?: any, extra: Record<string, unknown> = {}) => ({
  accountId,
  visible: true,
  ...(reportId ? { _id: reportId } : {}),
  ...extra
});

export const buildLocationReportScope = (accountId: any, reportId?: any, extra: Record<string, unknown> = {}) => ({
  account_id: accountId,
  visible: true,
  ...(reportId ? { _id: reportId } : {}),
  ...extra
});
