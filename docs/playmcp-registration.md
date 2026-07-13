# PlayMCP 등록 정보 — PoomSchool(품스쿨)

## 등록값

| 항목 | 값 |
|---|---|
| 서비스명 | 품스쿨 |
| 영문명 | PoomSchool |
| MCP 식별자 | `poomschool` |
| MCP URL | `https://<PUBLIC_DOMAIN>/mcp` (placeholder, 운영자가 실제 공개 도메인으로 교체) |
| Transport | Streamable HTTP |
| Server type | Remote MCP Server |
| Session | Stateless |
| Authentication | OAuth 2.1 (Bearer Token, Resource Server) |
| Tool 개수 | 10 |
| 기본 사용자 응답 언어 | 한국어 |
| 다국어 처리 | AI Provider가 지원하는 다양한 언어와 한국어 간 양방향 번역 (docs/multilingual-policy.md 참고) |
| 주요 사용자 | 초등학생 자녀를 둔 다문화가정 및 북한배경 가정의 부모 |

## MCP 프로토콜 지원 범위

- 최소 지원 버전: `2025-03-26`
- 최대 지원 버전: `2025-11-25`
- 지원 버전 목록: `2025-03-26`, `2025-06-18`, `2025-11-25`
- 지원 범위를 벗어난 `protocolVersion`으로 `initialize` 요청 시 JSON-RPC 오류를 반환합니다.

## Tool 목록 (10개)

1. `analyze_notice` — 학교 안내문 분석
2. `translate_notice` — 학교 안내 번역
3. `explain_term` — 학교 용어 설명
4. `draft_teacher_message` — 담임교사 메시지 작성
5. `set_parent_preferences` — 학부모 언어 설정
6. `save_tasks` — 학교 할 일 저장
7. `list_tasks` — 학교 할 일 조회
8. `complete_task` — 학교 할 일 완료
9. `delete_task` — 학교 할 일 삭제
10. `weekly_brief` — 이번 주 학부모 브리핑

## 등록 전 체크리스트

- [x] 공개 HTTPS URL을 사용할 것 (`PUBLIC_BASE_URL`을 실제 도메인으로 교체 필요 — placeholder 상태)
- [x] MCP 프로토콜 버전 범위 확인 (2025-03-26 ~ 2025-11-25)
- [x] Streamable HTTP 단일 전송 방식 사용, stdio/구형 SSE 미사용
- [x] Stateless 동작 확인 (세션 ID 미사용, `sessionIdGenerator: undefined`)
- [x] Tool 이름 규칙 준수 (소문자 snake_case, 1~128자, 중복 없음, `kakao` 미포함)
- [x] Tool description 규칙 준수 (영어 작성, `PoomSchool(품스쿨)` 포함, 1024자 이하)
- [x] 모든 Tool에 5종 annotations 명시 (title, readOnlyHint, destructiveHint, openWorldHint, idempotentHint)
- [x] OAuth 2.1 Resource Server 구현 (401/403, WWW-Authenticate, Protected Resource Metadata)
- [x] MCP Inspector로 tools/list, tools/call, 오류 처리 확인 (`npm run dev` 후 `scripts/inspect.sh`)
- [x] 성능 목표: MockAiProvider 기준 p99 3,000ms 이내 확인 (`npm run benchmark`)
- [x] 광고 및 외부 서비스 홍보 문구 없음 (Tool 응답 검토 완료)
- [x] 원본 API/AI Provider 응답을 그대로 반환하지 않음 (Markdown 가공 응답만 반환)
- [x] 개인정보 처리방침 초안 작성 (`docs/privacy-policy.md`, 법률 검토 필요)
- [x] 제3자 제공 동의문 템플릿 작성 (`docs/third-party-consent-template.md`, 법률 검토 필요)
- [ ] 문의 및 삭제 요청 경로에 실제 연락처 반영 (`<CONTACT_EMAIL>` 등 placeholder 교체 필요 — 운영자 작업)
- [x] 서비스명/식별자에 금지 문자열(`kakao`) 없음 확인

## OAuth Redirect URI

PlayMCP에 MCP를 등록한 뒤, 발급된 실제 `mcpId`로 다음 형식의 Redirect URI를 OAuth
Client에 등록합니다.

```
https://playmcp.kakao.com/api/v1/applied-mcps/{mcpId}/authorize/oauth:callback
```

## 운영자가 반드시 교체해야 하는 Placeholder 값

- `PUBLIC_BASE_URL` (공개 도메인)
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (AI_PROVIDER=anthropic 사용 시)
- `DATABASE_URL` (운영 PostgreSQL)
- PlayMCP MCP ID (Redirect URI에 반영)
