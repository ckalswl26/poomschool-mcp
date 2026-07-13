import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { Env } from '../config/env.js';
import type { AppLogger } from '../config/logger.js';

/**
 * jose 기반 JWT/JWKS 검증 OAuthTokenVerifier.
 * issuer, audience, expiration, signature를 모두 검증한다.
 * 토큰 원문은 로그에 남기지 않는다.
 */
export class JwksOAuthTokenVerifier implements OAuthTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly issuer: string,
    private readonly audience: string,
    jwksUrl: string,
    private readonly logger: AppLogger,
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      const scopeClaim = payload.scope;
      const scopes =
        typeof scopeClaim === 'string'
          ? scopeClaim.split(' ').filter(Boolean)
          : Array.isArray(payload.scp)
            ? (payload.scp as string[])
            : [];

      return {
        token,
        clientId: typeof payload.client_id === 'string' ? payload.client_id : (payload.azp as string) ?? 'unknown',
        scopes,
        expiresAt: payload.exp,
        extra: { sub: payload.sub },
      };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        this.logger.warn('oauth_token_expired');
        throw new InvalidTokenError('Token has expired');
      }
      if (error instanceof joseErrors.JWTClaimValidationFailed) {
        this.logger.warn({ claim: error.claim }, 'oauth_token_claim_invalid');
        throw new InvalidTokenError(`Token claim validation failed: ${error.claim}`);
      }
      this.logger.warn('oauth_token_invalid');
      throw new InvalidTokenError('Token verification failed');
    }
  }
}

export function buildBearerAuthMiddleware(
  env: Env,
  logger: AppLogger,
): { middleware: RequestHandler; resourceMetadataUrl: string } {
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(`${env.PUBLIC_BASE_URL}/mcp`));
  const verifier = new JwksOAuthTokenVerifier(env.OAUTH_ISSUER, env.OAUTH_AUDIENCE, env.OAUTH_JWKS_URL, logger);
  const middleware = requireBearerAuth({ verifier, resourceMetadataUrl });
  return { middleware, resourceMetadataUrl };
}

/** 개발 전용 우회 미들웨어. production에서는 env 검증 단계에서 이미 차단된다. */
export function buildDevAuthBypassMiddleware(devUserSub: string): RequestHandler {
  return (req, _res, next) => {
    req.auth = {
      token: 'dev-mode-token',
      clientId: 'dev-client',
      scopes: ['poomschool:read', 'poomschool:write'],
      extra: { sub: devUserSub },
    };
    next();
  };
}

export function extractOAuthSubject(authInfo: AuthInfo | undefined, fallbackSub?: string): string {
  const sub = authInfo?.extra?.sub;
  if (typeof sub === 'string' && sub.length > 0) return sub;
  if (fallbackSub) return fallbackSub;
  throw new Error('OAuth subject를 확인할 수 없습니다.');
}
