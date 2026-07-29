const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSubscriptionLimitMessage,
  buildSubscriptionLimitStatus,
  subscriptionLimitService
} = require('../dist/masters/company/subscriptionLimit.service');
const { AccountModel } = require('../dist/models/account.model');
const { AssetModel } = require('../dist/models/asset.model');

test('zero and negative values are treated as unlimited', () => {
  const zero = buildSubscriptionLimitStatus('asset', 0, 500);
  const negative = buildSubscriptionLimitStatus('location', -10, 500);

  assert.equal(zero.unlimited, true);
  assert.equal(zero.reached, false);
  assert.equal(zero.remaining, null);
  assert.equal(negative.unlimited, true);
  assert.equal(negative.reached, false);
});

test('positive limits report remaining and reached state', () => {
  const available = buildSubscriptionLimitStatus('user', 5, 4);
  const reached = buildSubscriptionLimitStatus('user', 5, 5);

  assert.equal(available.remaining, 1);
  assert.equal(available.reached, false);
  assert.equal(reached.remaining, 0);
  assert.equal(reached.reached, true);
});

test('limit message includes the requested count and INTERNAL remediation', () => {
  const status = buildSubscriptionLimitStatus('asset', 5, 4);
  const message = buildSubscriptionLimitMessage(status, 2);

  assert.match(message, /Cannot add 2 assets/);
  assert.match(message, /subscription limit is 5 assets/);
  assert.match(message, /Increase the limit in INTERNAL/);
});

test('account schema exposes all INTERNAL subscription limit fields', () => {
  assert.ok(AccountModel.schema.path('user_limit'));
  assert.ok(AccountModel.schema.path('location_limit'));
  assert.ok(AccountModel.schema.path('asset_limit'));
});

test('service permits unlimited usage and rejects positive limits with stable details', async () => {
  const originalFindById = AccountModel.findById;
  const originalCountDocuments = AssetModel.countDocuments;

  try {
    AccountModel.findById = () => accountQuery({ asset_limit: 0 });
    AssetModel.countDocuments = () => countQuery(999);
    await assert.doesNotReject(() => subscriptionLimitService.assertCanCreate('account-1', 'asset'));

    AccountModel.findById = () => accountQuery({ asset_limit: 5 });
    AssetModel.countDocuments = () => countQuery(5);
    await assert.rejects(
      () => subscriptionLimitService.assertCanCreate('account-1', 'asset'),
      error => {
        assert.equal(error.status, 403);
        assert.equal(error.code, 'SUBSCRIPTION_LIMIT_REACHED');
        assert.equal(error.data.limit, 5);
        assert.equal(error.data.current, 5);
        assert.equal(error.data.requested, 1);
        return true;
      }
    );
  } finally {
    AccountModel.findById = originalFindById;
    AssetModel.countDocuments = originalCountDocuments;
  }
});

function accountQuery(account) {
  return {
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean() {
      return Promise.resolve(account);
    }
  };
}

function countQuery(count) {
  return {
    session() {
      return Promise.resolve(count);
    }
  };
}
