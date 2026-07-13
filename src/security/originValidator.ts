import type { NextFunction, Request, Response } from 'express';

export interface OriginValidatorOptions {
  allowedOrigins: string[];
  allowMissingOrigin: boolean;
}

/**
 * Origin 헤더 allowlist 검증.
 * - Origin이 존재하고 allowlist에 없으면 403.
 * - Origin이 없는 서버 간 요청은 ALLOW_MISSING_ORIGIN 환경변수로 정책을 명확히 관리한다.
 */
export function originValidatorMiddleware(options: OriginValidatorOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (!origin) {
      if (options.allowMissingOrigin) {
        next();
        return;
      }
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: '허용되지 않은 요청입니다 (Origin 헤더 필요).' },
        id: null,
      });
      return;
    }

    if (options.allowedOrigins.length === 0 || options.allowedOrigins.includes(origin)) {
      next();
      return;
    }

    res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: '허용되지 않은 Origin입니다.' },
      id: null,
    });
  };
}
