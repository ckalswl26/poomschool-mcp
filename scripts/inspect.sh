#!/usr/bin/env bash
# PoomSchool(품스쿨) MCP 서버를 공식 MCP Inspector로 점검하기 위한 스크립트.
# 사전 준비: 서버가 실행 중이어야 한다 (예: npm run dev 또는 docker compose up).
set -euo pipefail

MCP_URL="${MCP_URL:-http://localhost:3000/mcp}"

echo "PoomSchool(품스쿨) MCP 서버 Inspector를 시작합니다."
echo "대상 URL: ${MCP_URL}"
echo
echo "Inspector가 열리면 다음을 확인하세요:"
echo "  1) Connect: Streamable HTTP, URL=${MCP_URL}"
echo "  2) initialize / protocolVersion negotiation (2025-03-26 ~ 2025-11-25)"
echo "  3) tools/list: 정확히 10개, annotations 5종 모두 존재, description에 PoomSchool(품스쿨) 포함"
echo "  4) 각 Tool을 실제로 호출해 한국어 Markdown 응답을 확인"
echo "  5) 잘못된 입력을 넣어 isError:true 응답을 확인"
echo "  6) OAuth 적용 시 Authorization 헤더 없이 호출하면 401을 확인"
echo

npx @modelcontextprotocol/inspector "${MCP_URL}"
