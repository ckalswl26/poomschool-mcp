import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

export function newRequestId(): string {
  return `req_${randomUUID()}`;
}
