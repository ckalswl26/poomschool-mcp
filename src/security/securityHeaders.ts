import type { NextFunction, Request, Response } from 'express';

/** 기본 보안 HTTP 헤더. HTTPS 종단은 리버스 프록시/플랫폼에서 종료된다고 가정한다. */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}
