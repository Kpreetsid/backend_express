require('dotenv').config();
const mongoose = require('mongoose');

function buildMongoUri() {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI;
  }

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '27017';
  const dbName = process.env.DB_NAME || 'cmms';
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const authSource = process.env.DB_AUTH_SOURCE || 'admin';

  if (user && password) {
    return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?authSource=${encodeURIComponent(authSource)}`;
  }

  return `mongodb://${host}:${port}/${dbName}`;
}

async function run() {
  const uri = buildMongoUri();
  await mongoose.connect(uri);

  const accounts = mongoose.connection.collection('account_master');
  const result = await accounts.updateMany(
    {
      $or: [
        { experience_profile: 'standard' },
        { experience_profile: 'insights' },
        { experience_profile: { $exists: false } },
        { experience_profile: null },
        { experience_profile: '' }
      ]
    },
    [
      {
        $set: {
          experience_profile: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$experience_profile', 'insights'] },
                  then: 'oem'
                },
                {
                  case: { $eq: ['$experience_profile', 'standard'] },
                  then: 'standard_account'
                }
              ],
              default: 'standard_account'
            }
          }
        }
      }
    ]
  );

  console.log(`Matched: ${result.matchedCount}, Updated: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Failed to backfill account experience profiles:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors
  }
  process.exit(1);
});
