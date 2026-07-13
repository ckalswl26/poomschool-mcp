import { mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Router } from 'express';
import type { Env } from '../config/env.js';
import { OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE, SERVICE_NAME_BILINGUAL } from '../config/constants.js';

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)의 최소 구성.
 * 실제 운영 시에는 OAUTH_ISSUER가 게시하는 공식 metadata 문서의 값과 일치하는지
 * 반드시 확인해야 한다 (docs/oauth-setup.md 참고).
 */
function buildAuthorizationServerMetadata(env: Env): OAuthMetadata {
  const issuer = env.OAUTH_ISSUER.replace(/\/$/, '');
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    scopes_supported: [OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  };
}

/**
 * RFC 9728 OAuth Protected Resource Metadata 라우터.
 * 리소스 URL이 `/mcp`이므로 실제 경로는 `/.well-known/oauth-protected-resource/mcp`가 된다
 * (MCP SDK의 `getOAuthProtectedResourceMetadataUrl` 규칙을 따름).
 */
export function buildOAuthMetadataRouter(env: Env): Router {
  return mcpAuthMetadataRouter({
    oauthMetadata: buildAuthorizationServerMetadata(env),
    resourceServerUrl: new URL(`${env.PUBLIC_BASE_URL}/mcp`),
    resourceName: SERVICE_NAME_BILINGUAL,
    scopesSupported: [OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE],
  });
}
