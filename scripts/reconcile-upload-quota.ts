import fs from 'node:fs';
import path from 'node:path';
import { connectDB, disconnectDB } from '../src/_db';
import { validateConfiguration } from '../src/configDB';
import { reconcileUploadQuotaUsage } from '../src/upload/upload-quota-reconciliation';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const run = async (): Promise<void> => {
  const reportPath = argument('--report');
  const execute = process.argv.includes('--execute');
  if (!reportPath) {
    throw new Error(
      'Usage: npm run uploads:quota-reconcile -- --report <report.json> [--execute]'
    );
  }
  validateConfiguration();
  await connectDB();
  const report = await reconcileUploadQuotaUsage(execute);
  const resolvedReportPath = path.resolve(reportPath);
  await fs.promises.mkdir(path.dirname(resolvedReportPath), { recursive: true });
  await fs.promises.writeFile(
    resolvedReportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: 'wx' }
  );
  process.stdout.write(
    `${report.mode} complete: ${report.totals.accounts} account(s), `
    + `${report.totals.accountsWithDrift} with drift, `
    + `${report.expiredReservations} expired reservation(s). `
    + `Report: ${resolvedReportPath}\n`
  );
};

run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
