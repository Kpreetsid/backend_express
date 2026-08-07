import fs from 'node:fs';
import path from 'node:path';
import { S3StorageProvider } from '../src/_config/storage';
import { migrateLocalUploads } from '../src/upload/upload-migration';
import { validateConfiguration } from '../src/configDB';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const run = async (): Promise<void> => {
  const source = argument('--source');
  const reportPath = argument('--report');
  const execute = process.argv.includes('--execute');
  if (!source || !reportPath) {
    throw new Error(
      'Usage: npm run uploads:migrate -- --source <local-directory> --report <report.json> [--execute]'
    );
  }

  validateConfiguration();
  const report = await migrateLocalUploads(source, new S3StorageProvider(), execute);
  const resolvedReportPath = path.resolve(reportPath);
  await fs.promises.mkdir(path.dirname(resolvedReportPath), { recursive: true });
  await fs.promises.writeFile(resolvedReportPath, `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx'
  });

  process.stdout.write(
    `${report.mode} complete: ${report.totals.discovered} discovered, `
    + `${report.totals.migrated} migrated, ${report.totals.failed} failed. `
    + `Report: ${resolvedReportPath}\n`
  );
  if (report.totals.failed > 0) process.exitCode = 1;
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
