import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { analyzeNoticeInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { analyzeNoticeWithCache } from '../services/noticeAnalysisService.js';
import { bulletList, numberedList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';
import { LOW_CONFIDENCE_THRESHOLD } from '../config/constants.js';

const TOOL_NAME = 'analyze_notice';

const COST_STATUS_TEXT: Record<string, string> = {
  not_required: '이 안내문 기준으로는 별도로 납부해야 할 비용이 없습니다.',
  unknown: '현재 안내문에는 지금 납부해야 할 금액이 명확히 표시되어 있지 않습니다. 학교에 확인이 필요할 수 있습니다.',
};

export function registerAnalyzeNoticeTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 안내문 분석',
      description:
        "Analyzes an elementary school notice in PoomSchool(품스쿨) and converts it into a concise parent action guide, including parent responsibilities, child preparation items, deadlines, costs, submission instructions, uncertain details, school questions, and an optional translation in the parent's language.",
      inputSchema: analyzeNoticeInputShape,
      annotations: {
        title: '학교 안내문 분석',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args, extra): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const userId = extractOAuthSubject(extra.authInfo);
        const profile = await deps.userProfileRepo.findBySubject(userId);
        const parentLanguage = args.parent_language ?? profile?.preferredLanguageCode ?? 'ko';
        const explanationLevel = args.explanation_level ?? profile?.explanationLevel ?? 'standard';

        const result = await analyzeNoticeWithCache(
          {
            aiProvider: deps.aiProvider,
            cacheRepository: deps.analysisCacheRepo,
            cacheEnabled: deps.cacheEnabled,
            cacheTtlSeconds: deps.cacheTtlSeconds,
          },
          {
            userId,
            noticeText: args.notice_text,
            childGrade: args.child_grade,
            parentLanguage,
            sourceLanguage: args.source_language,
            explanationLevel,
            explanationMode: args.explanation_mode,
            includeTranslation: args.include_translation,
          },
        );

        const parentTaskLines = result.parentTasks.map((t) => {
          const extras: string[] = [];
          if (t.dueAt) extras.push(`기한: ${t.dueAt}`);
          if (t.requiresSignature) extras.push('서명 필요');
          if (t.requiresPayment) extras.push('비용 발생');
          return extras.length > 0 ? `${t.title} (${extras.join(', ')})` : t.title;
        });

        const tellChild = result.childInformation.filter((c) => c.type === 'tell_child').map((c) => c.content);
        const prepareForChild = result.childInformation
          .filter((c) => c.type === 'prepare_for_child')
          .map((c) => c.content);
        const childMaterial = result.childInformation.filter((c) => c.type === 'child_material').map((c) => c.content);
        const allMaterials = [...childMaterial, ...result.materials];

        const costLines: string[] = [];
        if (result.cost.status === 'required') {
          if (result.cost.amount) costLines.push(`금액: ${result.cost.amount.toLocaleString('ko-KR')}원`);
          if (result.cost.paymentMethod) costLines.push(`납부 방법: ${result.cost.paymentMethod}`);
          if (result.cost.paymentDate) costLines.push(`납부일: ${result.cost.paymentDate}`);
          if (costLines.length === 0) costLines.push('비용이 필요하지만 구체적인 금액이 안내문에 명확히 표시되지 않았습니다.');
        } else {
          costLines.push(COST_STATUS_TEXT[result.cost.status] ?? '');
        }

        const submissionLines: string[] = [];
        if (result.submission.recipient) submissionLines.push(`제출 대상: ${result.submission.recipient}`);
        if (result.submission.method) submissionLines.push(`제출 방법: ${result.submission.method}`);
        if (result.submission.deadline) submissionLines.push(`제출 기한: ${result.submission.deadline}`);

        const languageWarning =
          args.source_language === 'auto' && result.languageConfidence < LOW_CONFIDENCE_THRESHOLD
            ? '> 안내문의 언어 감지 신뢰도가 낮습니다. 정확한 분석을 위해 언어를 직접 선택해 주세요.'
            : null;

        const markdown = renderMarkdown([
          languageWarning,
          section('어떤 안내인가요?', result.purpose),
          section('쉬운 한국어 요약', result.easyKoreanSummary),
          section('부모님이 해야 할 일', parentTaskLines.length > 0 ? numberedList(parentTaskLines) : null),
          section('아이에게 알려줄 일', tellChild.length > 0 ? bulletList(tellChild) : null),
          section('아이를 위해 준비할 일', prepareForChild.length > 0 ? bulletList(prepareForChild) : null),
          section('아이가 챙길 준비물', allMaterials.length > 0 ? bulletList(allMaterials) : null),
          section('비용', costLines.length > 0 ? costLines.join('\n') : null),
          section('제출 정보', submissionLines.length > 0 ? submissionLines.join('\n') : null),
          section('학교 확인 필요', result.unknowns.length > 0 ? bulletList(result.unknowns) : null),
          section(
            '선생님께 물어볼 질문',
            result.questionsForSchool.length > 0
              ? result.questionsForSchool.map((q) => `"${q}"`).join('\n\n')
              : null,
          ),
          section(`부모님 언어로 보기 (${result.targetLanguage ?? parentLanguage})`, result.translatedSummary),
          result.unknowns.length > 0 ? '> 안내문에 없는 내용은 학교에 직접 확인해야 합니다.' : null,
        ]);

        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: true, timestamp: Date.now() });
        return { content: [{ type: 'text', text: markdown }], isError: false };
      } catch (error) {
        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: false, timestamp: Date.now() });
        return toToolErrorResult(error, deps.logger, TOOL_NAME);
      }
    },
  );
}
