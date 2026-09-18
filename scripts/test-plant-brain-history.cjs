const assert = require('node:assert/strict');
const http = require('node:http');

const { proxyPlantBrainHistory, PlantBrainProxyError } = require('../dist/plantBrain/plantBrain.proxy.js');

const THREAD_ID = '11111111-1111-4111-8111-111111111111';
const scope = {
  tenantId: 'tenant-1',
  plantId: 'plant-1',
  principalId: 'user-1',
  assetIds: ['asset-1'],
  locationIds: ['plant-1'],
  assetLocationId: 'location-1',
  assetName: 'Pump A',
  locationName: 'Area A'
};
const issuer = {
  mint() {
    return { token: 'delegated-token' };
  }
};

function snapshot(assetId = 'asset-1') {
  return {
    snapshot: {
      thread: {
        threadId: THREAD_ID,
        pageContext: JSON.stringify({
          schemaVersion: 'presage_asset_thread_context_v1',
          assetId,
          route: '/assets/asset-1/assistant'
        })
      },
      messages: [
        {
          role: 'user',
          text: 'What is wrong with this pump?',
          createdAt: '2026-09-18T00:00:00.000Z'
        },
        {
          role: 'assistant',
          text: 'Misalignment is the current Presage finding.',
          createdAt: '2026-09-18T00:00:01.000Z',
          unifiedResult: {
            status: 'answered',
            citations: [
              {
                citationId: 'diag-1',
                kind: 'OPERATIONAL',
                evidence: { title: 'Current diagnostic' }
              }
            ],
            limitations: ['Confirm during inspection.']
          }
        }
      ]
    }
  };
}

async function withServer(payload, fn) {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer delegated-token');
    assert.match(req.url, new RegExp('^/v1/brain/threads/' + THREAD_ID));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(payload));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

(async () => {
  await withServer(snapshot(), async baseUrl => {
    const result = await proxyPlantBrainHistory(scope, issuer, THREAD_ID, {
      baseUrl,
      timeoutMs: 2000
    });
    assert.equal(result.thread_id, THREAD_ID);
    assert.equal(result.messages.length, 2);
    assert.deepEqual(result.messages[0], {
      role: 'user',
      text: 'What is wrong with this pump?',
      created_at: '2026-09-18T00:00:00.000Z'
    });
    assert.equal(result.messages[1].role, 'assistant');
    assert.equal(result.messages[1].text, 'Misalignment is the current Presage finding.');
    assert.equal(result.messages[1].abstained, false);
    assert.deepEqual(result.messages[1].limitations, ['Confirm during inspection.']);
    assert.deepEqual(result.messages[1].evidence_refs, [{
      id: 'diag-1',
      kind: 'operational',
      label: 'Current diagnostic',
      title: 'Current diagnostic',
      route: '/assets/analysis-details/asset-1'
    }]);
  });

  await withServer(snapshot('asset-2'), async baseUrl => {
    await assert.rejects(
      () => proxyPlantBrainHistory(scope, issuer, THREAD_ID, { baseUrl, timeoutMs: 2000 }),
      error => error instanceof PlantBrainProxyError
        && error.code === 'plant_brain_thread_asset_mismatch'
        && error.status === 409
    );
  });

  await withServer({ snapshot: { thread: { threadId: THREAD_ID }, messages: [null] } }, async baseUrl => {
    await assert.rejects(
      () => proxyPlantBrainHistory(scope, issuer, THREAD_ID, { baseUrl, timeoutMs: 2000 }),
      error => error instanceof PlantBrainProxyError
        && error.code === 'plant_brain_upstream_invalid'
        && error.status === 502
    );
  });

  console.log('plant_brain_history_regression=PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
