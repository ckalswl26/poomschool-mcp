import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.js';
import { allowedOriginsList } from '../config/env.js';
import type { AppLogger } from '../config/logger.js';
import type { ToolDeps } from './toolDeps.js';
import { createMcpServer } from './createMcpServer.js';
import { securityHeadersMiddleware } from '../security/securityHeaders.js';
import { originValidatorMiddleware } from '../security/originValidator.js';
import { MAX_REQUEST_BODY_SIZE } from '../security/requestSizeLimit.js';
import { InMemoryRateLimiter, rateLimiterMiddleware } from '../security/rateLimiter.js';
import { buildBearerAuthMiddleware, buildDevAuthBypassMiddleware } from '../auth/bearerAuth.js';
import { scopeGuardMiddleware } from '../auth/scopeGuard.js';
import { buildOAuthMetadataRouter } from '../auth/oauthMetadata.js';
import { SUPPORTED_PROTOCOL_VERSIONS } from './protocolVersions.js';
import { MCP_ENDPOINT_PATH, MCP_SERVER_VERSION, MIN_PROTOCOL_VERSION, MAX_PROTOCOL_VERSION } from '../config/constants.js';

interface JsonRpcInitializeBody {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: { protocolVersion?: string };
}

function protocolVersionGuardMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const body = req.body as JsonRpcInitializeBody | undefined;
  if (body?.method === 'initialize') {
    const requested = body.params?.protocolVersion;
    if (requested && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
      res.status(200).json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: -32602,
          message: `지원하지 않는 MCP protocolVersion입니다. 지원 범위: ${MIN_PROTOCOL_VERSION} ~ ${MAX_PROTOCOL_VERSION}`,
        },
      });
      return;
    }
  }
  next();
}

const METHOD_NOT_ALLOWED_BODY = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
};

export interface BuildAppOptions {
  env: Env;
  logger: AppLogger;
  deps: ToolDeps;
  prismaClient: PrismaClient;
}

export function buildExpressApp(options: BuildAppOptions): Express {
  const { env, logger, deps, prismaClient } = options;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(securityHeadersMiddleware);
  // 요청/응답 시간을 구조화 로그로 기록한다 (Authorization 헤더는 logger의 redact 설정으로 마스킹됨).
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' } }));

  const allowedOrigins = allowedOriginsList(env);
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      methods: ['GET', 'POST', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Protocol-Version', 'Mcp-Session-Id'],
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'poomschool-mcp', version: MCP_SERVER_VERSION });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      logger.error({ err: error instanceof Error ? error.message : String(error) }, 'readiness_check_failed');
      res.status(503).json({ status: 'not_ready' });
    }
  });

  if (!env.AUTH_DISABLED) {
    app.use(buildOAuthMetadataRouter(env));
  }

  app.use(express.json({ limit: MAX_REQUEST_BODY_SIZE }));
  // 요청 본문이 너무 크거나 JSON 형식이 아니면 스택을 노출하지 않고 안전하게 400을 반환한다.
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'type' in err) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: '요청 본문이 너무 크거나 형식이 올바르지 않습니다.' },
        id: null,
      });
      return;
    }
    next(err);
  });
  app.use(originValidatorMiddleware({ allowedOrigins, allowMissingOrigin: env.ALLOW_MISSING_ORIGIN }));

  const limiter = new InMemoryRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  });

  const authMiddleware = env.AUTH_DISABLED
    ? buildDevAuthBypassMiddleware(env.DEV_USER_SUB)
    : buildBearerAuthMiddleware(env, logger).middleware;

  app.post(
    MCP_ENDPOINT_PATH,
    rateLimiterMiddleware(limiter),
    authMiddleware,
    scopeGuardMiddleware,
    protocolVersionGuardMiddleware,
    async (req, res) => {
      const server = createMcpServer(deps);
      try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => {
          transport.close();
          server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error({ err: error instanceof Error ? error.message : String(error) }, 'mcp_request_failed');
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    },
  );

  app.get(MCP_ENDPOINT_PATH, (_req, res) => {
    res.status(405).json(METHOD_NOT_ALLOWED_BODY);
  });

  app.delete(MCP_ENDPOINT_PATH, (_req, res) => {
    res.status(405).json(METHOD_NOT_ALLOWED_BODY);
  });

  return app;
}
