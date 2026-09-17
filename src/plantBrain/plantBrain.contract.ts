export interface PlantBrainUiContext {
  surface: 'asset_assistant';
  route: string;
}

export interface PlantBrainRespondRequest {
  question: string;
  ui_asset_id: string;
  client_turn_id: string;
  thread_id?: string;
  ui_context: PlantBrainUiContext;
}

export interface PlantBrainEvidenceRef {
  id?: string;
  kind?: string;
  label?: string;
  title?: string;
  route?: string;
}

export interface PlantBrainRespondResponse {
  thread_id?: string;
  answer: string;
  abstained?: boolean;
  evidence_refs?: PlantBrainEvidenceRef[];
  citations?: unknown[];
  limitations?: string[];
}

export class PlantBrainRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'PlantBrainRequestError';
  }
}

const THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_TURN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const parsePlantBrainRespondRequest = (body: unknown): PlantBrainRespondRequest => {
  if (!isRecord(body)) {
    throw new PlantBrainRequestError('Request body must be a JSON object', 422, 'invalid_request');
  }

  if (typeof body.question !== 'string' || !body.question.trim()) {
    throw new PlantBrainRequestError('question must be a non-empty string', 422, 'invalid_question');
  }
  const question = body.question.trim();
  if (question.length > 4000) {
    throw new PlantBrainRequestError('question exceeds 4000 characters', 422, 'invalid_question');
  }

  if (typeof body.ui_asset_id !== 'string' || !body.ui_asset_id.trim()) {
    throw new PlantBrainRequestError('ui_asset_id must be a non-empty string', 422, 'invalid_asset_hint');
  }
  const uiAssetId = body.ui_asset_id.trim();

  if (typeof body.client_turn_id !== 'string' || !CLIENT_TURN_ID_PATTERN.test(body.client_turn_id.trim())) {
    throw new PlantBrainRequestError('client_turn_id must be a UUID v4', 422, 'invalid_client_turn_id');
  }
  const clientTurnId = body.client_turn_id.trim().toLowerCase();

  let threadId: string | undefined;
  if (body.thread_id !== undefined) {
    if (typeof body.thread_id !== 'string' || !THREAD_ID_PATTERN.test(body.thread_id.trim())) {
      throw new PlantBrainRequestError('thread_id must be a UUID', 422, 'invalid_thread_id');
    }
    threadId = body.thread_id.trim().toLowerCase();
  }

  if (!isRecord(body.ui_context)) {
    throw new PlantBrainRequestError('ui_context must be an object', 422, 'invalid_ui_context');
  }
  if (body.ui_context.surface !== 'asset_assistant') {
    throw new PlantBrainRequestError('ui_context.surface is not supported', 422, 'invalid_ui_context');
  }
  if (typeof body.ui_context.route !== 'string' || !body.ui_context.route.trim()) {
    throw new PlantBrainRequestError('ui_context.route must be a non-empty string', 422, 'invalid_ui_context');
  }
  const route = body.ui_context.route.trim().slice(0, 500);
  if (!route.startsWith('/assets/')) {
    throw new PlantBrainRequestError('ui_context.route must be an asset route', 422, 'invalid_ui_context');
  }

  return {
    question,
    ui_asset_id: uiAssetId,
    client_turn_id: clientTurnId,
    ...(threadId ? { thread_id: threadId } : {}),
    ui_context: {
      surface: 'asset_assistant',
      route
    }
  };
};
