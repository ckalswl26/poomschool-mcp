import { createServer, type Server } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT, type CryptoKey } from 'jose';

export interface TestJwksContext {
  url: string;
  issuer: string;
  audience: string;
  privateKey: CryptoKey;
  close: () => Promise<void>;
}

const KID = 'test-key-1';
const ALG = 'ES256';

export async function startTestJwksServer(issuer: string, audience: string): Promise<TestJwksContext> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = KID;
  publicJwk.alg = ALG;
  publicJwk.use = 'sig';

  const server: Server = createServer((req, res) => {
    if (req.url?.includes('jwks')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/jwks.json`;

  return {
    url,
    issuer,
    audience,
    privateKey,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface SignTestTokenOptions {
  sub: string;
  scope?: string;
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string;
}

export async function signTestToken(ctx: TestJwksContext, options: SignTestTokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope: options.scope ?? 'poomschool:read poomschool:write' })
    .setProtectedHeader({ alg: ALG, kid: KID })
    .setSubject(options.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expiresInSeconds ?? 3600))
    .setIssuer(options.issuer ?? ctx.issuer)
    .setAudience(options.audience ?? ctx.audience)
    .sign(ctx.privateKey);
}
