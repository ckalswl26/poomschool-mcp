# OAuth 2.1 설정 가이드 (PoomSchool(품스쿨))

PoomSchool(품스쿨) MCP 서버는 OAuth 2.1 **Resource Server**로 동작합니다. 서버 자체는
Authorization Server(로그인, 토큰 발급)를 구현하지 않으며, 외부 OAuth Provider(운영자가
지정한 `OAUTH_ISSUER`)가 발급한 Bearer Token(JWT)을 검증하는 역할만 수행합니다.

## 1. 필요한 환경변수

| 변수 | 설명 |
|---|---|
| `OAUTH_ISSUER` | 토큰을 발급하는 Authorization Server의 issuer URL (placeholder, 운영자가 교체) |
| `OAUTH_AUDIENCE` | 이 리소스 서버를 가리키는 audience 값. 보통 `https://<PUBLIC_DOMAIN>/mcp` |
| `OAUTH_JWKS_URL` | Authorization Server가 공개하는 JWKS 엔드포인트 |
| `AUTH_DISABLED` | 개발 전용 우회 플래그. `production`에서는 `true`로 설정할 수 없으며 시작 시 강제로 차단됩니다 |
| `DEV_USER_SUB` | `AUTH_DISABLED=true`일 때 사용되는 고정 테스트 사용자 식별자 |

`OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`은 운영자가 실제 IdP(예: 사내 OAuth 서버,
Auth0, Keycloak 등)의 공식 값으로 반드시 교체해야 합니다. 이 저장소에는 placeholder만 포함되어 있습니다.

## 2. 필요 scope

| Scope | 대상 Tool |
|---|---|
| `poomschool:read` | analyze_notice, translate_notice, explain_term, draft_teacher_message, list_tasks, weekly_brief |
| `poomschool:write` | set_parent_preferences, save_tasks, complete_task, delete_task |

## 3. PKCE (S256)

PoomSchool(품스쿨)은 스스로 Authorization Code를 발급하지 않지만, 클라이언트(PlayMCP 등)가
`OAUTH_ISSUER`와 Authorization Code + PKCE(S256) 플로우로 토큰을 발급받는 것을 전제로 합니다.
운영자는 `OAUTH_ISSUER` 쪽에 다음을 반드시 설정해야 합니다.

- `code_challenge_method=S256` 지원
- Public Client(Client Secret 없이) 등록 지원 또는 Confidential Client + PKCE 병행

PoomSchool(품스쿨) 서버는 PKCE 검증 자체를 수행하지 않습니다(그 역할은 Authorization Server의
책임입니다). 대신 발급된 Access Token의 서명/issuer/audience/만료를 엄격히 검증합니다.

## 4. 토큰 검증 방식

- 라이브러리: `jose` (`createRemoteJWKSet` + `jwtVerify`)
- 검증 항목: 서명(JWKS), `iss`(issuer), `aud`(audience), `exp`(만료)
- `scope` 클레임(공백 구분 문자열) 또는 `scp` 배열 클레임을 모두 지원
- 검증 실패 시 HTTP 401, `WWW-Authenticate` 헤더에 `resource_metadata`(Protected Resource
  Metadata 위치) 포함
- scope 부족 시 HTTP 403
- Access Token 원문은 로그에 남기지 않음 (Pino `redact` 설정)
- Access Token을 AI Provider(Anthropic 등)로 전달하지 않음

## 5. OAuth Protected Resource Metadata

`AUTH_DISABLED=false`일 때 다음 엔드포인트가 자동으로 노출됩니다.

```
GET /.well-known/oauth-protected-resource/mcp
```

(MCP 리소스 경로가 `/mcp`이므로 RFC 9728 규칙에 따라 `/mcp`가 접미사로 붙습니다.)

RFC 9728에 따른 메타데이터(`resource`, `authorization_servers`, `scopes_supported` 등)를
반환합니다. `WWW-Authenticate` 헤더의 `resource_metadata` 값이 이 URL을 가리킵니다.

## 6. PlayMCP 연동 절차

1. PlayMCP에 PoomSchool(품스쿨)을 MCP로 등록하고 `mcpId`를 발급받습니다.
2. `OAUTH_ISSUER`에 OAuth Client를 등록하고, Redirect URI를 다음 형식으로 설정합니다.

   ```
   https://playmcp.kakao.com/api/v1/applied-mcps/{mcpId}/authorize/oauth:callback
   ```

   `{mcpId}`는 실제 PlayMCP에 등록된 MCP ID로 교체합니다.
3. Client에 `poomschool:read`, `poomschool:write` scope를 부여합니다.
4. `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL` 환경변수를 실제 값으로 설정하고
   서버를 재시작합니다.
5. PlayMCP에서 OAuth 로그인 플로우를 완료하면 발급된 Access Token으로 `/mcp` 호출이 가능합니다.

## 7. 연동 해제 절차

1. PlayMCP 관리 화면에서 PoomSchool(품스쿨) 연동을 해제합니다.
2. `OAUTH_ISSUER` 쪽에서 발급된 토큰/리프레시 토큰을 revoke합니다.
3. 운영자는 해당 사용자의 `UserProfile`, `SchoolTask` 데이터를 삭제 요청에 따라 파기합니다
   (아래 데이터 삭제 절차 참고).

## 8. 데이터 삭제 절차

1. 사용자가 삭제를 요청하면 운영자는 `oauthSubject` 기준으로 다음을 삭제합니다.
   - `UserProfile` 레코드
   - `SchoolTask` 레코드 (soft delete가 아닌 완전 삭제)
   - `AnalysisCache` 레코드
2. 삭제는 지체 없이 수행하며, 관계 법령상 별도 보존 의무가 있는 경우에만 예외로 합니다.
3. 삭제 완료 후 사용자에게 처리 결과를 통지합니다.

## 9. 참고

- 이 문서는 MCP 공식 Authorization 명세(OAuth 2.1, RFC 9728 Protected Resource Metadata,
  RFC 8414 Authorization Server Metadata)를 기준으로 작성되었습니다.
- 실제 운영 전, 사용하는 IdP의 공식 문서와 대조하여 issuer/JWKS/scope 설정을 다시 한 번
  확인하시기 바랍니다.
