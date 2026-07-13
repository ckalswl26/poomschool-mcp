export const SERVICE_NAME_KO = '품스쿨';
export const SERVICE_NAME_EN = 'PoomSchool';
export const SERVICE_NAME_BILINGUAL = 'PoomSchool(품스쿨)';
export const MCP_SERVER_ID = 'poomschool';
export const MCP_SERVER_VERSION = '0.1.0';

export const MCP_ENDPOINT_PATH = '/mcp';

export const MIN_PROTOCOL_VERSION = '2025-03-26';
export const MAX_PROTOCOL_VERSION = '2025-11-25';
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2025-06-18', '2025-11-25'] as const;

export const NOTICE_TEXT_MAX_LENGTH = 10_000;
export const PARENT_INPUT_MAX_LENGTH = 4_000;
export const CONTEXT_MAX_LENGTH = 2_000;
export const TERM_MAX_LENGTH = 200;
export const SOURCE_SUMMARY_MAX_LENGTH = 500;
export const CHILD_ALIAS_MAX_LENGTH = 50;

export const MAX_TOOL_RESULT_LENGTH = 6_000;

export const DEFAULT_AI_TIMEOUT_MS = 2_500;
export const DEFAULT_ANALYSIS_CACHE_TTL_SECONDS = 900;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60;

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const OAUTH_SCOPE_READ = 'poomschool:read';
export const OAUTH_SCOPE_WRITE = 'poomschool:write';
