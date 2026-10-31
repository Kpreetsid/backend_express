import { supportLogin } from '@core/config/env.config';

export const isAuthorizedSupportActorResponse = (payload: any): boolean =>
  payload?.status === true && payload?.authorized === true;

export const authorizeSupportActor = async (input: {
  actorId: string;
  companyId: string;
  environment: 'staging' | 'production';
}): Promise<void> => {
  if (!supportLogin.introspectionUrl || !supportLogin.serviceKey) {
    throw Object.assign(new Error('Support-login introspection is not configured'), { status: 503 });
  }

  const response = await fetch(supportLogin.introspectionUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-support-login-key': supportLogin.serviceKey
    },
    body: JSON.stringify({
      actor_id: input.actorId,
      company_id: input.companyId,
      environment: input.environment
    })
  });

  if (!response.ok) {
    throw Object.assign(new Error('Support-login actor is no longer authorized'), {
      status: response.status === 401 || response.status === 403 ? 403 : 502
    });
  }

  const payload: any = await response.json().catch(() => null);
  if (!isAuthorizedSupportActorResponse(payload)) {
    throw Object.assign(new Error('Support-login actor is no longer authorized'), { status: 403 });
  }
};
