import { createPublicKey, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import type { PlantBrainTrustedAssetScope } from './plantBrain.scope';

export interface PlantBrainDelegatedIdentityConfig {
  privateKeyFile: string;
  keyId: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
}

export interface PlantBrainDelegatedIdentity {
  token: string;
  expiresAt: string;
  jti: string;
}

interface PublicJwk extends Record<string, unknown> {
  kid: string;
  use: 'sig';
  alg: 'RS256';
}

const normalizedHttpsUrl = (value: string, label: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an HTTPS URL without credentials, query or fragment`);
  }
  return url.toString().replace(/\/$/, '');
};

export const plantBrainDelegatedIdentityConfigFromEnv = (): PlantBrainDelegatedIdentityConfig => {
  const privateKeyFile = process.env.PLANT_BRAIN_DELEGATION_PRIVATE_KEY_FILE?.trim();
  const keyId = process.env.PLANT_BRAIN_DELEGATION_KEY_ID?.trim();
  const issuerRaw = process.env.PLANT_BRAIN_DELEGATION_ISSUER?.trim();
  const audienceRaw = process.env.PLANT_BRAIN_DELEGATION_AUDIENCE?.trim();
  const ttlRaw = process.env.PLANT_BRAIN_DELEGATION_TTL_SECONDS?.trim() || '180';
  const ttlSeconds = Number(ttlRaw);

  if (!privateKeyFile) throw new Error('PLANT_BRAIN_DELEGATION_PRIVATE_KEY_FILE is required');
  if (!keyId || !/^[A-Za-z0-9._-]{1,80}$/.test(keyId)) throw new Error('PLANT_BRAIN_DELEGATION_KEY_ID is invalid');
  if (!issuerRaw) throw new Error('PLANT_BRAIN_DELEGATION_ISSUER is required');
  if (!audienceRaw) throw new Error('PLANT_BRAIN_DELEGATION_AUDIENCE is required');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 300) {
    throw new Error('PLANT_BRAIN_DELEGATION_TTL_SECONDS must be an integer from 60 to 300');
  }

  return {
    privateKeyFile,
    keyId,
    issuer: normalizedHttpsUrl(issuerRaw, 'PLANT_BRAIN_DELEGATION_ISSUER'),
    audience: audienceRaw,
    ttlSeconds
  };
};

/**
 * Internal token exchange for an already authenticated CMMS principal.
 *
 * Claims come only from the server-resolved PlantBrainTrustedAssetScope. The delegated token
 * authenticates the Plant Brain caller; it never replaces the original CMMS source credential.
 */
export class PlantBrainDelegatedIdentityIssuer {
  private readonly privateKey: string;
  private readonly publicJwk: PublicJwk;

  constructor(private readonly config: PlantBrainDelegatedIdentityConfig) {
    this.privateKey = readFileSync(config.privateKeyFile, 'utf8');
    if (!this.privateKey.includes('PRIVATE KEY')) throw new Error('Plant Brain delegation private key file is not a PEM private key');

    const publicKey = createPublicKey(this.privateKey);
    const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    if (jwk.kty !== 'RSA') throw new Error('Plant Brain delegation key must be RSA');
    this.publicJwk = {
      ...jwk,
      kid: config.keyId,
      use: 'sig',
      alg: 'RS256'
    };
  }

  jwks(): { keys: PublicJwk[] } {
    return { keys: [{ ...this.publicJwk }] };
  }

  mint(scope: PlantBrainTrustedAssetScope, now = new Date()): PlantBrainDelegatedIdentity {
    if (!scope.tenantId || !scope.plantId || !scope.principalId) {
      throw new Error('Trusted Plant Brain scope is incomplete');
    }
    if (scope.locationIds.length !== 1 || scope.locationIds[0] !== scope.plantId) {
      throw new Error('Delegated Plant Brain identity requires exact K6 plant-root scope');
    }

    const jti = randomUUID();
    const issuedAtSeconds = Math.floor(now.getTime() / 1000);
    const expiresAtSeconds = issuedAtSeconds + this.config.ttlSeconds;
    const token = jwt.sign(
      {
        iat: issuedAtSeconds,
        exp: expiresAtSeconds,
        presage_roles: ['operator'],
        presage_tenants: [scope.tenantId],
        presage_plants: [scope.plantId],
        presage_delegation: {
          source: 'cmms_authenticated_bff',
          version: 1
        }
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        keyid: this.config.keyId,
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: scope.principalId,
        jwtid: jti,
        header: { typ: 'JWT', alg: 'RS256', kid: this.config.keyId }
      }
    );

    return {
      token,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      jti
    };
  }
}
