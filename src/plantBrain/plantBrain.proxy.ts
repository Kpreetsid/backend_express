import axios from 'axios';
import type { Request } from 'express';
import type {
  PlantBrainEvidenceRef,
  PlantBrainHistoryResponse,
  PlantBrainRespondRequest,
  PlantBrainRespondResponse
} from './plantBrain.contract';
import type { PlantBrainDelegatedIdentityIssuer } from './plantBrain.delegatedIdentity';
import type { PlantBrainTrustedAssetScope } from './plantBrain.scope';

export class PlantBrainProxyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'PlantBrainProxyError';
  }
}

interface PlantBrainProxyConfig {
  baseUrl: string;
  timeoutMs: number;
  sourceEnv?: string;
}

interface UpstreamThread {
  threadId: string;
  pageContext?: string;
}

interface UpstreamThreadSnapshot extends UpstreamThread {
  messages: Record<string, unknown>[];
}

interface UpstreamUnifiedAnswer {
  status: 'answered' | 'abstained';
  answer: string;
  citations: unknown[];
  limitations: string[];
}

interface PresageAuthenticatedRequest extends Request {
  userToken?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_CONTEXT_SCHEMA = 'presage_asset_thread_context_v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PLANT_BRAIN_TEXT_API_URL must be a valid URL');
  }

  const insecureLocalhost = process.env.PLANT_BRAIN_ALLOW_INSECURE_LOCALHOST === 'true'
    && url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !insecureLocalhost) {
    throw new Error('PLANT_BRAIN_TEXT_API_URL must use HTTPS except explicitly allowed localhost');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('PLANT_BRAIN_TEXT_API_URL must not contain credentials, query or fragment');
  }
  return url.toString().replace(/\/$/, '');
}

export const plantBrainProxyConfigFromEnv = (): PlantBrainProxyConfig => {
  const baseUrlRaw = process.env.PLANT_BRAIN_TEXT_API_URL?.trim();
  if (!baseUrlRaw) throw new Error('PLANT_BRAIN_TEXT_API_URL is required');

  const timeoutRaw = process.env.PLANT_BRAIN_PROXY_TIMEOUT_MS?.trim() || '150000';
  const timeoutMs = Number(timeoutRaw);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 180000) {
    throw new Error('PLANT_BRAIN_PROXY_TIMEOUT_MS must be an integer from 1000 to 180000');
  }

  const sourceEnv = process.env.PLANT_BRAIN_SOURCE_ENV?.trim();
  if (sourceEnv && !/^[A-Za-z0-9._-]{1,64}$/.test(sourceEnv)) {
    throw new Error('PLANT_BRAIN_SOURCE_ENV is invalid');
  }

  return {
    baseUrl: normalizedBaseUrl(baseUrlRaw),
    timeoutMs,
    ...(sourceEnv ? { sourceEnv } : {})
  };
};

function sourceAuthorization(req: Request): string {
  const token = (req as PresageAuthenticatedRequest).userToken;
  if (typeof token !== 'string' || !token.trim()) {
    throw new PlantBrainProxyError('Authenticated Presage source credential is unavailable', 503, 'plant_brain_source_credential_unavailable');
  }
  return `Bearer ${token.trim()}`;
}

function scopedUrl(config: PlantBrainProxyConfig, path: string, scope: PlantBrainTrustedAssetScope): string {
  const url = new URL(`${config.baseUrl}${path}`);
  url.searchParams.set('tenantId', scope.tenantId);
  url.searchParams.set('plantId', scope.plantId);
  return url.toString();
}

function mapUpstreamFailure(status: number): PlantBrainProxyError {
  if (status === 401 || status === 403) {
    return new PlantBrainProxyError('Plant Brain delegated identity was rejected', 503, 'plant_brain_identity_unavailable');
  }
  if (status === 404) {
    return new PlantBrainProxyError('Plant Brain thread is unavailable', 404, 'plant_brain_thread_not_found');
  }
  if (status === 409) {
    return new PlantBrainProxyError('Plant Brain thread is busy or conflicted', 409, 'plant_brain_thread_conflict');
  }
  if (status === 422) {
    return new PlantBrainProxyError('Plant Brain integration contract was rejected', 502, 'plant_brain_contract_mismatch');
  }
  if (status === 429 || status >= 500) {
    return new PlantBrainProxyError('Plant Brain is temporarily unavailable', 503, 'plant_brain_upstream_unavailable');
  }
  return new PlantBrainProxyError('Plant Brain returned an unexpected response', 502, 'plant_brain_upstream_invalid');
}

async function upstreamJson(
  config: PlantBrainProxyConfig,
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: Record<string, unknown>
): Promise<unknown> {
  try {
    const response = await axios.request({
      method,
      url,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers
      },
      ...(body ? { data: body } : {}),
      timeout: config.timeoutMs,
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 256 * 1024,
      validateStatus: () => true
    });
    if (response.status < 200 || response.status >= 300) throw mapUpstreamFailure(response.status);
    return response.data as unknown;
  } catch (error) {
    if (error instanceof PlantBrainProxyError) throw error;
    throw new PlantBrainProxyError('Plant Brain is temporarily unavailable', 503, 'plant_brain_upstream_unavailable');
  }
}

function canonicalPageContext(assetId: string, route: string): string {
  return JSON.stringify({
    schemaVersion: PAGE_CONTEXT_SCHEMA,
    assetId,
    route: route.slice(0, 300)
  });
}

function boundAssetId(pageContext: unknown): string | undefined {
  if (typeof pageContext !== 'string' || !pageContext.trim()) return undefined;
  try {
    const parsed = JSON.parse(pageContext) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== PAGE_CONTEXT_SCHEMA || typeof parsed.assetId !== 'string') return undefined;
    return parsed.assetId;
  } catch {
    return undefined;
  }
}

function parseCreatedThread(payload: unknown): UpstreamThread {
  if (!isRecord(payload) || !isRecord(payload.thread) || typeof payload.thread.threadId !== 'string' || !UUID_PATTERN.test(payload.thread.threadId)) {
    throw new PlantBrainProxyError('Plant Brain returned an invalid thread response', 502, 'plant_brain_upstream_invalid');
  }
  return {
    threadId: payload.thread.threadId.toLowerCase(),
    ...(typeof payload.thread.pageContext === 'string' ? { pageContext: payload.thread.pageContext } : {})
  };
}

function parseThreadSnapshot(payload: unknown): UpstreamThreadSnapshot {
  if (!isRecord(payload) || !isRecord(payload.snapshot) || !isRecord(payload.snapshot.thread)
    || typeof payload.snapshot.thread.threadId !== 'string' || !UUID_PATTERN.test(payload.snapshot.thread.threadId)
    || !Array.isArray(payload.snapshot.messages)) {
    throw new PlantBrainProxyError('Plant Brain returned an invalid thread snapshot', 502, 'plant_brain_upstream_invalid');
  }
  const messages = payload.snapshot.messages.filter(isRecord);
  if (messages.length !== payload.snapshot.messages.length) {
    throw new PlantBrainProxyError('Plant Brain returned invalid thread messages', 502, 'plant_brain_upstream_invalid');
  }
  return {
    threadId: payload.snapshot.thread.threadId.toLowerCase(),
    ...(typeof payload.snapshot.thread.pageContext === 'string' ? { pageContext: payload.snapshot.thread.pageContext } : {}),
    messages
  };
}

function parseUnifiedAsk(payload: unknown): { threadId: string; result: UpstreamUnifiedAnswer; citations: unknown[] } {
  if (!isRecord(payload) || !isRecord(payload.result) || typeof payload.result.threadId !== 'string'
    || !UUID_PATTERN.test(payload.result.threadId) || !isRecord(payload.result.result)) {
    throw new PlantBrainProxyError('Plant Brain returned an invalid persistent answer', 502, 'plant_brain_upstream_invalid');
  }
  const unified = payload.result.result;
  const status = unified.status;
  const answer = unified.answer;
  const citations = unified.citations;
  const limitations = unified.limitations;
  if ((status !== 'answered' && status !== 'abstained') || typeof answer !== 'string' || !answer.trim()
    || !Array.isArray(citations) || !Array.isArray(limitations) || limitations.some(item => typeof item !== 'string')) {
    throw new PlantBrainProxyError('Plant Brain returned an invalid unified answer', 502, 'plant_brain_upstream_invalid');
  }
  return {
    threadId: payload.result.threadId.toLowerCase(),
    result: {
      status,
      answer: answer.trim(),
      citations,
      limitations: limitations as string[]
    },
    citations
  };
}

function evidenceRefs(citations: unknown[], assetId: string): PlantBrainEvidenceRef[] {
  return citations.flatMap((citation, index) => {
    if (!isRecord(citation) || typeof citation.citationId !== 'string' || !citation.citationId.trim()) return [];
    const kind = citation.kind === 'OPERATIONAL' || citation.kind === 'DOCUMENT' ? citation.kind : 'EVIDENCE';
    const evidence = isRecord(citation.evidence) ? citation.evidence : undefined;
    const title = evidence && typeof evidence.title === 'string' ? evidence.title.trim() : '';
    const label = title || (kind === 'OPERATIONAL' ? 'Operational evidence' : kind === 'DOCUMENT' ? 'Document evidence' : `Evidence ${index + 1}`);
    return [{
      id: citation.citationId,
      kind: kind.toLowerCase(),
      label,
      ...(title ? { title } : {}),
      ...(kind === 'OPERATIONAL' ? { route: `/assets/analysis-details/${assetId}` } : {})
    }];
  });
}

function historyMessages(snapshot: UpstreamThreadSnapshot, assetId: string): PlantBrainHistoryResponse['messages'] {
  return snapshot.messages.flatMap((message) => {
    const role = message.role;
    const text = message.text;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) return [];

    const unified = isRecord(message.unifiedResult) ? message.unifiedResult : undefined;
    const citations = unified && Array.isArray(unified.citations) ? unified.citations : [];
    const limitations = unified && Array.isArray(unified.limitations)
      ? unified.limitations.filter((item): item is string => typeof item === 'string')
      : [];
    const status = unified?.status;

    return [{
      role,
      text: text.trim(),
      ...(typeof message.createdAt === 'string' ? { created_at: message.createdAt } : {}),
      ...(role === 'assistant' && citations.length ? { evidence_refs: evidenceRefs(citations, assetId) } : {}),
      ...(role === 'assistant' && limitations.length ? { limitations } : {}),
      ...(role === 'assistant' && (status === 'answered' || status === 'abstained') ? { abstained: status === 'abstained' } : {})
    }];
  });
}

export async function proxyPlantBrainHistory(
  scope: PlantBrainTrustedAssetScope,
  issuer: PlantBrainDelegatedIdentityIssuer,
  threadId: string,
  config = plantBrainProxyConfigFromEnv()
): Promise<PlantBrainHistoryResponse> {
  const delegated = issuer.mint(scope);
  const assetId = scope.assetIds[0];
  if (!assetId || scope.assetIds.length !== 1 || scope.locationIds.length !== 1 || scope.locationIds[0] !== scope.plantId) {
    throw new PlantBrainProxyError('Trusted Plant Brain analysis scope is invalid', 503, 'plant_brain_scope_invalid');
  }

  const payload = await upstreamJson(
    config,
    'GET',
    scopedUrl(config, `/v1/brain/threads/${threadId}`, scope),
    { authorization: `Bearer ${delegated.token}` }
  );
  const snapshot = parseThreadSnapshot(payload);
  if (snapshot.threadId !== threadId.toLowerCase() || boundAssetId(snapshot.pageContext) !== assetId) {
    throw new PlantBrainProxyError('This Plant Brain thread is bound to a different asset', 409, 'plant_brain_thread_asset_mismatch');
  }

  return {
    thread_id: snapshot.threadId,
    messages: historyMessages(snapshot, assetId)
  };
}

async function createThread(
  config: PlantBrainProxyConfig,
  scope: PlantBrainTrustedAssetScope,
  delegatedToken: string,
  pageContext: string,
  clientCreationKey: string
): Promise<UpstreamThread> {
  const payload = await upstreamJson(
    config,
    'POST',
    scopedUrl(config, '/v1/brain/threads', scope),
    { authorization: `Bearer ${delegatedToken}` },
    { pageContext, clientCreationKey }
  );
  return parseCreatedThread(payload);
}

async function verifyExistingThreadBinding(
  config: PlantBrainProxyConfig,
  scope: PlantBrainTrustedAssetScope,
  delegatedToken: string,
  threadId: string,
  assetId: string
): Promise<void> {
  const payload = await upstreamJson(
    config,
    'GET',
    scopedUrl(config, `/v1/brain/threads/${threadId}`, scope),
    { authorization: `Bearer ${delegatedToken}` }
  );
  const thread = parseThreadSnapshot(payload);
  if (thread.threadId !== threadId.toLowerCase() || boundAssetId(thread.pageContext) !== assetId) {
    throw new PlantBrainProxyError('This Plant Brain thread is bound to a different asset', 409, 'plant_brain_thread_asset_mismatch');
  }
}

export async function proxyPlantBrainRespond(
  req: Request,
  input: PlantBrainRespondRequest,
  scope: PlantBrainTrustedAssetScope,
  issuer: PlantBrainDelegatedIdentityIssuer,
  config = plantBrainProxyConfigFromEnv()
): Promise<PlantBrainRespondResponse> {
  const sourceAuth = sourceAuthorization(req);
  const delegated = issuer.mint(scope);
  const assetId = scope.assetIds[0];
  if (!assetId || scope.assetIds.length !== 1 || scope.locationIds.length !== 1 || scope.locationIds[0] !== scope.plantId) {
    throw new PlantBrainProxyError('Trusted Plant Brain analysis scope is invalid', 503, 'plant_brain_scope_invalid');
  }

  const pageContext = canonicalPageContext(assetId, input.ui_context.route);
  let threadId = input.thread_id;
  if (threadId) {
    await verifyExistingThreadBinding(config, scope, delegated.token, threadId, assetId);
  } else {
    threadId = (await createThread(config, scope, delegated.token, pageContext, input.client_turn_id)).threadId;
  }

  const askHeaders: Record<string, string> = {
    authorization: `Bearer ${delegated.token}`,
    'x-presage-source-authorization': sourceAuth,
    ...(config.sourceEnv ? { 'x-env': config.sourceEnv } : {})
  };
  const payload = await upstreamJson(
    config,
    'POST',
    scopedUrl(config, `/v1/brain/threads/${threadId}/ask`, scope),
    askHeaders,
    {
      question: input.question,
      clientTurnId: input.client_turn_id,
      pageContext,
      analysisContext: {
        locationIds: [...scope.locationIds],
        assetIds: [...scope.assetIds]
      }
    }
  );
  const answer = parseUnifiedAsk(payload);
  if (answer.threadId !== threadId.toLowerCase()) {
    throw new PlantBrainProxyError('Plant Brain returned a mismatched thread identity', 502, 'plant_brain_upstream_invalid');
  }

  return {
    thread_id: threadId.toLowerCase(),
    answer: answer.result.answer,
    abstained: answer.result.status === 'abstained',
    evidence_refs: evidenceRefs(answer.citations, assetId),
    citations: answer.citations,
    limitations: [...answer.result.limitations]
  };
}
