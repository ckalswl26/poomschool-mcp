import { MAX_PROTOCOL_VERSION, MIN_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '../config/constants.js';

export { MIN_PROTOCOL_VERSION, MAX_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS };

export function isSupportedProtocolVersion(version: string): boolean {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}
