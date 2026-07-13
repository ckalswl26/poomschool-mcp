# PoomSchool(품스쿨) MCP Server

초등학생 자녀를 둔 다문화가정 및 북한이탈주민·북한배경 가정의 부모를 위한 학교생활 관리
Remote MCP Server입니다. MCP 식별자는 `poomschool`이며, Streamable HTTP 전송 방식의
Stateless MCP 서버로 구현되어 있습니다.

핵심 사용자는 아이가 아니라 **부모**입니다. 품스쿨은 학교 안내문을 번역만 하는 것이 아니라
부모가 해야 할 일, 아이에게 알려줄 일, 준비물, 마감일, 비용, 제출 방법 등 실행 가능한
정보로 변환합니다.

## 기술 스택

- TypeScript 5.9 / Node.js 20+ (Active LTS)
- 공식 MCP TypeScript SDK `@modelcontextprotocol/sdk` `1.29.0`
- Express 5 (SDK와 함께 검증된 Streamable HTTP 전송)
- Zod 3.25
- PostgreSQL + Prisma ORM `6.19.3`
- OAuth 2.1 Bearer Token 검증 (jose)
- Pino 구조화 로깅
- Vitest / ESLint / Prettier
- Docker / Docker Compose

## 프로젝트 구조

```
src/
  index.ts                 서버 엔트리포인트
  server/                  McpServer 팩토리, Streamable HTTP, 프로토콜 버전
  tools/                   10개 MCP Tool 구현
  services/                번역/분석/용어집/태스크/마크다운 렌더러, AI Provider
  auth/                    OAuth 2.1 Resource Server (Bearer 검증, scope, metadata)
  database/                Prisma 클라이언트, Repository
  security/                Origin 검증, rate limit, 보안 헤더, 로그 마스킹
  schemas/                 Zod 입력 스키마
  config/, errors/, utils/ 환경변수, 오류 처리, 유틸리티
prisma/                    schema.prisma, migrations
tests/                     unit / integration / security / privacy / multilingual / performance
docs/                      OAuth, 개인정보, 다국어 정책, PlayMCP 등록 문서
scripts/                   MCP Inspector 실행, 성능 벤치마크
```

## 로컬 실행

### 1) 의존성 설치

```bash
npm install
```

### 2) PostgreSQL 실행

Docker Compose로 PostgreSQL만 실행할 수도 있고, 로컬에 이미 설치된 PostgreSQL을 사용할
수도 있습니다.

```bash
docker compose up -d postgres
```

### 3) 환경변수 설정

```bash
cp .env.example .env
```

`.env`에서 최소한 `DATABASE_URL`을 로컬 PostgreSQL에 맞게 조정하세요. 로컬 개발에서는
`AUTH_DISABLED=true`, `AI_PROVIDER=mock`으로 시작하는 것을 권장합니다.

### 4) Prisma 마이그레이션

```bash
npm run prisma:migrate
```

### 5) 개발 서버 실행

```bash
npm run dev
```

기본적으로 `http://localhost:3000/mcp`에서 서비스됩니다.

## 테스트 / Lint / Typecheck / Build

테스트는 실제 PostgreSQL(기본값: `poomschool_test` 데이터베이스)과 `MockAiProvider`를
사용하며, 실제 Anthropic API를 호출하지 않습니다.

```bash
# 테스트용 DB 준비 (최초 1회)
createdb poomschool_test
DATABASE_URL="postgresql://<user>@localhost:5432/poomschool_test?schema=public" npx prisma migrate deploy

npm run lint
npm run typecheck
npm test
npm run build
```

## 성능 벤치마크

```bash
DATABASE_URL="postgresql://<user>@localhost:5432/poomschool_test?schema=public" npm run benchmark
```

`list_tasks`, `complete_task`, `explain_term`(용어집 캐시 hit), `set_parent_preferences`,
`analyze_notice`(MockAiProvider), `translate_notice`(MockAiProvider), `weekly_brief`를 각 100회
호출해 평균/p50/p95/p99/최소/최대/실패율을 출력합니다. p99가 3,000ms를 초과하면 스크립트가
실패(exit code 1)합니다.

**주의**: 이 벤치마크는 MockAiProvider 기준입니다. 실제 `AnthropicAiProvider`의 성능은
네트워크 상태와 모델 응답 시간에 따라 달라지며 별도로 측정해야 합니다.

## Docker

```bash
docker build -t poomschool-mcp .
docker compose up -d
```

Dockerfile은 multi-stage build, non-root 사용자 실행, healthcheck를 포함합니다. 컨테이너
시작 시 `prisma migrate deploy`를 실행한 뒤 서버를 시작합니다(단일 인스턴스 배포 기준이며,
다중 인스턴스 운영 시에는 마이그레이션을 별도 단계로 분리하는 것을 권장합니다).

> 이 개발 환경에는 Docker/Podman CLI가 설치되어 있지 않아 실제 `docker build` 실행 자체는
> 검증하지 못했습니다(미검증). Dockerfile/구성 파일은 공식 모범 사례를 따르며, Docker가
> 설치된 환경에서 위 명령으로 검증해야 합니다.

## MCP Inspector로 검증하기

```bash
npm run dev
# 다른 터미널에서
bash scripts/inspect.sh
```

Inspector에서 다음을 확인합니다.

1. Streamable HTTP 연결 (`http://localhost:3000/mcp`)
2. `initialize` / protocolVersion negotiation (2025-03-26 ~ 2025-11-25)
3. `tools/list`: 정확히 10개, 모든 annotations 존재, 모든 description에
   `PoomSchool(품스쿨)` 포함
4. 각 Tool 호출 결과가 한국어 Markdown인지 확인
5. 잘못된 입력에 대해 `isError:true`가 반환되는지 확인
6. `AUTH_DISABLED=false`일 때 Authorization 헤더 없이 호출하면 401이 반환되는지 확인

## OAuth 설정

[docs/oauth-setup.md](./docs/oauth-setup.md)를 참고하세요. issuer, audience, JWKS,
scope, PKCE, PlayMCP Redirect URI 설정, 연동 해제 절차를 다룹니다.

## PlayMCP 등록

[docs/playmcp-registration.md](./docs/playmcp-registration.md)에 등록값과 체크리스트를
정리했습니다.

## 개인정보 삭제 절차

1. 사용자가 삭제를 요청하거나 PlayMCP 연동을 해제하면 운영자는 `oauthSubject` 기준으로
   `UserProfile`, `SchoolTask`, `AnalysisCache` 레코드를 완전히 삭제합니다.
2. 자세한 내용은 [docs/privacy-policy.md](./docs/privacy-policy.md)와
   [docs/oauth-setup.md](./docs/oauth-setup.md)의 "데이터 삭제 절차"를 참고하세요.

## 다국어 정책

[docs/multilingual-policy.md](./docs/multilingual-policy.md)에 언어 자동 감지, BCP-47
사용 규칙, 원문 보존 규칙, 설명 모드(`general`/`multicultural_parent`/`north_korean_parent`)를
정리했습니다.

## 알려진 제한사항 (MVP 범위)

- 이미지 OCR, 사진 속 가정통신문 자동 인식 미지원
- 카카오톡 대화/알림톡 자동 수집 미지원
- 담임교사에게 메시지를 자동 전송하지 않음 (부모가 직접 확인 후 전송)
- 아이용 챗봇, 숙제 정답 제공 없음
- 학교 포털 자동 로그인, 교육지원 자격 자동 확정 없음
- 학교폭력 여부 판정, 의료/심리 진단, 성적/행동 평가 없음
- 정부 기관 서류 자동 제출 없음
- `AnthropicAiProvider`는 코드상 구현되어 있으나 실제 Anthropic API 키로 호출 검증은
  이 환경에서 수행하지 못했습니다(테스트는 MockAiProvider만 사용). 실제 배포 전
  `AI_PROVIDER=anthropic` 설정으로 별도 검증이 필요합니다.
- Docker build 자체는 이 개발 환경에 Docker CLI가 없어 미검증입니다.

## 운영 장애 대응 (요약)

- `/healthz`: 프로세스 생존 확인
- `/readyz`: PostgreSQL 연결 상태 확인 (`SELECT 1`)
- AI Provider 타임아웃(`AI_TIMEOUT_MS`, 기본 2500ms) 초과 시 한국어 오류 메시지 반환,
  결과를 추측해 반환하지 않음
- AI 응답이 스키마 검증에 실패하면 최대 1회 복구 요청 후 실패 시 안전한 오류 반환
- 구조화 로그(Pino)에 Authorization 헤더, 안내문 원문, 부모 메시지 원문, 아이 별칭을
  마스킹하여 기록하지 않음
