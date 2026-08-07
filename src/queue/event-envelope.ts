export interface QueueEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  tenantId: string;
  actorId?: string;
  correlationId: string;
  entity: {
    type: string;
    id: string;
  };
  timestamp: string;
  payload: TPayload;
}
