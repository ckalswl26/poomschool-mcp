import type { NextFunction, Request, Response } from 'express';
import { requiredScopeForTool } from './scopes.js';

interface JsonRpcToolCallBody {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: { name?: string };
}

/**
 * tools/call 요청의 Tool별 필요 scope를 확인하는 미들웨어.
 * requireBearerAuth 미들웨어 다음에 위치해야 하며 req.auth가 채워져 있어야 한다.
 * scope가 부족하면 JSON-RPC 처리 이전에 HTTP 403으로 응답한다.
 */
export function scopeGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as JsonRpcToolCallBody | undefined;
  if (!body || body.method !== 'tools/call') {
    next();
    return;
  }

  const toolName = body.params?.name;
  if (!toolName) {
    next();
    return;
  }

  const requiredScope = requiredScopeForTool(toolName);
  if (!requiredScope) {
    next();
    return;
  }

  const grantedScopes = req.auth?.scopes ?? [];
  if (!grantedScopes.includes(requiredScope)) {
    res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32003,
        message: `이 기능을 사용하려면 ${requiredScope} 권한이 필요합니다.`,
      },
      id: body.id ?? null,
    });
    return;
  }

  next();
}
