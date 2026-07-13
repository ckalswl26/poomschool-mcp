import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

/**
 * 사용자(또는 IP) 단위 고정 윈도우 rate limiter.
 * 프로세스 메모리 기반이므로 다중 인스턴스 운영 시에는 공유 스토어로 교체가 필요하다.
 */
export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimiterOptions) {}

  consume(key: string, now: number = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.options.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (bucket.count < this.options.maxRequests) {
      bucket.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: this.options.windowMs - (now - bucket.windowStart) };
  }

  reset(): void {
    this.buckets.clear();
  }
}

function resolveRateLimitKey(req: Request): string {
  const sub = req.auth?.extra?.sub;
  if (typeof sub === 'string' && sub.length > 0) return `user:${sub}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function rateLimiterMiddleware(limiter: InMemoryRateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = resolveRateLimitKey(req);
    const result = limiter.consume(key);
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000).toString());
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32029, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        id: null,
      });
      return;
    }
    next();
  };
}
