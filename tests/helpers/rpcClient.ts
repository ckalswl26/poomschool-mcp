import type { Express } from 'express';
import type { AddressInfo } from 'node:net';

export interface RpcClient {
  baseUrl: string;
  close: () => Promise<void>;
  rawResponse: (body: unknown, headers?: Record<string, string>) => Promise<Response>;
  rpc: (body: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: unknown }>;
  callTool: (
    name: string,
    args: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; result?: { content: Array<{ type: string; text: string }>; isError?: boolean }; error?: unknown }>;
  listTools: (headers?: Record<string, string>) => Promise<{ status: number; tools?: unknown[]; error?: unknown }>;
  initialize: (
    protocolVersion: string,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; result?: unknown; error?: unknown }>;
}

async function parseMcpResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (!text) return undefined;
  if (contentType.includes('text/event-stream')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    const last = dataLines[dataLines.length - 1];
    return last ? JSON.parse(last) : undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function startRpcClient(app: Express): Promise<RpcClient> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const rawResponse = async (body: unknown, headers: Record<string, string> = {}): Promise<Response> => {
    return fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  const rpc = async (
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; json: unknown }> => {
    const res = await rawResponse(body, headers);
    const json = await parseMcpResponse(res);
    return { status: res.status, json };
  };

  const initialize = async (protocolVersion: string, headers: Record<string, string> = {}) => {
    const { status, json } = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'test-client', version: '1.0' } },
      },
      headers,
    );
    const payload = json as { result?: unknown; error?: unknown } | undefined;
    return { status, result: payload?.result, error: payload?.error };
  };

  const listTools = async (headers: Record<string, string> = {}) => {
    const { status, json } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, headers);
    const payload = json as { result?: { tools?: unknown[] }; error?: unknown } | undefined;
    return { status, tools: payload?.result?.tools, error: payload?.error };
  };

  const callTool = async (name: string, args: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const { status, json } = await rpc(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } },
      headers,
    );
    const payload = json as
      | { result?: { content: Array<{ type: string; text: string }>; isError?: boolean }; error?: unknown }
      | undefined;
    return { status, result: payload?.result, error: payload?.error };
  };

  const close = (): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

  return { baseUrl, close, rawResponse, rpc, callTool, listTools, initialize };
}
