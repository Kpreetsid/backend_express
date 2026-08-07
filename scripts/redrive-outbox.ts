import { connectDB, disconnectDB } from '../src/_db';
import { applicationLogger } from '../src/observability/logger';
import { redriveDeadLetterEvent } from '../src/queue/outbox-publisher';

const argumentValue = (name: string): string | undefined => {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const eventId = argumentValue('--event-id');
const tenantId = argumentValue('--tenant-id');

if (!eventId || !tenantId) {
  throw new Error(
    'Usage: npm run outbox:redrive -- --event-id <event-id> --tenant-id <tenant-id>'
  );
}

async function run(): Promise<void> {
  await connectDB();
  try {
    const redriven = await redriveDeadLetterEvent(eventId as string, tenantId as string);
    if (!redriven) {
      throw new Error('No matching tenant-scoped dead-letter event was found');
    }
    applicationLogger.info({ eventId, tenantId }, 'Outbox event scheduled for redrive');
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => {
  applicationLogger.fatal({ err: error, eventId, tenantId }, 'Outbox redrive failed');
  process.exitCode = 1;
});
