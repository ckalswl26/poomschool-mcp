export interface GlossaryEntry {
  term: string;
  aliases: string[];
  easyMeaning: string;
  practicalExample: string;
  parentChecklist: string[];
  parentActions: string[];
  commonMisunderstandings: string[];
  schoolConfirmationNeeded: string[];
}

/**
 * 한국 초등학교 행정·교육 용어 사전. 메모리에 상주하는 정적 데이터이므로
 * 조회는 AI 호출 없이 100ms 이내로 처리된다 (explain_term 캐시 hit 경로).
 */
const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: '스쿨뱅킹',
    aliases: ['school banking'],
    easyMeaning:
      '학교가 학부모 계좌에서 급식비, 현장체험학습비 등 학교 비용을 자동으로 이체받는 제도입니다.',
    practicalExample: '매달 급식비가 등록한 계좌에서 자동으로 빠져나갑니다.',
    parentChecklist: ['계좌 등록 여부', '계좌 잔액', '이체 예정일'],
    parentActions: ['학교에서 안내한 은행 계좌를 스쿨뱅킹으로 등록합니다.'],
    commonMisunderstandings: ['스쿨뱅킹을 신청하지 않아도 자동으로 이체된다고 생각하는 경우가 있습니다.'],
    schoolConfirmationNeeded: ['계좌 등록 마감일', '계좌 변경 방법'],
  },
  {
    term: '방과후학교',
    aliases: ['방과후 학교', 'after school'],
    easyMeaning: '정규수업이 끝난 뒤 학교에서 운영하는 별도의 프로그램 수업입니다.',
    practicalExample: '정규수업이 끝난 뒤 학교에서 진행하는 영어, 미술, 축구 등의 프로그램입니다.',
    parentChecklist: ['신청 가능 과목', '수강료', '신청 마감일'],
    parentActions: ['원하는 과목을 선택해 신청서를 제출합니다.'],
    commonMisunderstandings: ['방과후학교가 무료라고 생각하는 경우가 있지만 대부분 수강료가 있습니다.'],
    schoolConfirmationNeeded: ['수강료 지원 대상 여부'],
  },
  {
    term: '돌봄교실',
    aliases: ['돌봄교실 신청'],
    easyMeaning: '맞벌이 등의 이유로 하교 후 아이를 돌봐줄 사람이 없는 가정을 위해 학교에서 아이를 돌봐주는 교실입니다.',
    practicalExample: '학교가 끝난 뒤 부모가 데리러 올 때까지 학교 안 돌봄교실에서 지낼 수 있습니다.',
    parentChecklist: ['신청 자격', '운영 시간', '신청 시기'],
    parentActions: ['재학 중인 학교에 돌봄교실 신청서를 제출합니다.'],
    commonMisunderstandings: ['모든 학생이 자유롭게 이용할 수 있다고 생각하지만 신청과 선정 절차가 있는 경우가 많습니다.'],
    schoolConfirmationNeeded: ['선정 기준', '대기 순번 여부'],
  },
  {
    term: '교외체험학습',
    aliases: ['교외 체험학습'],
    easyMeaning: '가족 여행 등 학교 밖에서 이루어지는 체험학습을 출석으로 인정받기 위한 절차입니다.',
    practicalExample: '가족 여행을 가면서 학교에 미리 신청서를 내면 결석이 아닌 출석으로 인정될 수 있습니다.',
    parentChecklist: ['사전 신청 여부', '신청서 제출 기한', '보고서 제출 여부'],
    parentActions: ['체험학습 계획서를 사전에 담임교사에게 제출합니다.'],
    commonMisunderstandings: ['다녀온 뒤에 신청해도 된다고 생각하는 경우가 있지만 대부분 사전 신청이 필요합니다.'],
    schoolConfirmationNeeded: ['연간 허용 일수', '사후 보고서 양식'],
  },
  {
    term: '수행평가',
    aliases: [],
    easyMeaning: '시험지를 푸는 방식이 아니라 발표, 과제, 실기 등으로 학습 과정을 평가하는 방식입니다.',
    practicalExample: '글쓰기 과제나 모둠 발표로 점수를 매기는 평가입니다.',
    parentChecklist: ['평가 일정', '준비물', '과제 제출 방법'],
    parentActions: ['아이가 준비물과 과제 기한을 챙길 수 있도록 안내합니다.'],
    commonMisunderstandings: ['수행평가를 시험처럼 한 번에 끝나는 것으로 오해하는 경우가 있습니다.'],
    schoolConfirmationNeeded: ['구체적인 평가 기준'],
  },
  {
    term: '교육급여',
    aliases: ['교육급여 신청'],
    easyMeaning: '국가가 소득 기준에 따라 교육비 일부를 지원하는 복지 제도입니다.',
    practicalExample: '소득 기준에 해당하면 학용품비, 부교재비 등을 지원받을 수 있습니다.',
    parentChecklist: ['신청 자격', '신청 기간', '필요 서류'],
    parentActions: ['주민센터 또는 복지로 홈페이지에서 신청 절차를 확인합니다.'],
    commonMisunderstandings: ['학교에 신청하는 것으로 오해하는 경우가 있지만 지자체·복지 기관을 통해 신청합니다.'],
    schoolConfirmationNeeded: ['최종 지원 대상 확정 여부는 학교가 아닌 담당 기관에 확인해야 합니다.'],
  },
  {
    term: '자유수강권',
    aliases: [],
    easyMeaning: '저소득층 학생에게 방과후학교 수강료를 지원해주는 이용권입니다.',
    practicalExample: '자유수강권을 받으면 방과후학교 수강료 부담이 줄어듭니다.',
    parentChecklist: ['지원 대상 여부', '사용 가능한 과목', '신청 시기'],
    parentActions: ['담임교사 또는 행정실에 지원 대상 여부를 문의합니다.'],
    commonMisunderstandings: ['모든 방과후학교 과목에 자유수강권을 사용할 수 있다고 오해하는 경우가 있습니다.'],
    schoolConfirmationNeeded: ['지원 가능 금액과 과목 범위'],
  },
  {
    term: '출석인정결석',
    aliases: ['출석 인정 결석'],
    easyMeaning: '결석을 하더라도 정해진 사유에 해당하면 출석한 것으로 인정해주는 제도입니다.',
    practicalExample: '가족 경조사나 감염병 격리 등의 사유는 결석이지만 출석으로 인정될 수 있습니다.',
    parentChecklist: ['인정 사유 해당 여부', '증빙서류 필요 여부', '제출 기한'],
    parentActions: ['사유 발생 시 담임교사에게 미리 알리고 증빙서류를 확인합니다.'],
    commonMisunderstandings: ['따로 알리지 않아도 자동으로 출석 인정된다고 오해하는 경우가 있습니다.'],
    schoolConfirmationNeeded: ['인정되는 구체적인 사유 범위'],
  },
  {
    term: '학교운영위원회',
    aliases: ['학운위'],
    easyMeaning: '학부모, 교사, 지역위원이 함께 학교 운영에 대해 의논하고 결정하는 회의 기구입니다.',
    practicalExample: '학교 예산이나 급식, 방과후학교 운영 방침 등을 의논하는 회의입니다.',
    parentChecklist: ['위원 선출 시기', '학부모 위원 참여 방법'],
    parentActions: ['관심이 있다면 학부모 위원 선출 공고를 확인합니다.'],
    commonMisunderstandings: ['교사만 참여하는 회의라고 오해하는 경우가 있지만 학부모 위원도 참여합니다.'],
    schoolConfirmationNeeded: ['이번 학기 회의 일정'],
  },
  {
    term: '학부모 상담주간',
    aliases: ['학부모상담주간'],
    easyMeaning: '담임교사와 개별 상담을 할 수 있도록 학교가 정해놓은 기간입니다.',
    practicalExample: '이 기간에 신청하면 담임선생님과 아이의 학교생활에 대해 이야기할 수 있습니다.',
    parentChecklist: ['상담 신청 방법', '상담 가능 시간', '상담 방식(대면/전화)'],
    parentActions: ['희망하는 상담 시간을 신청합니다.'],
    commonMisunderstandings: ['상담주간에만 담임교사와 연락할 수 있다고 오해하는 경우가 있지만 평소에도 연락이 가능합니다.'],
    schoolConfirmationNeeded: ['정확한 신청 방법과 마감일'],
  },
  {
    term: '개인정보 수집·이용 동의서',
    aliases: ['개인정보 수집 이용 동의서', '개인정보동의서'],
    easyMeaning: '학교가 학생과 학부모의 개인정보를 특정 목적으로 사용해도 되는지 동의를 받는 서류입니다.',
    practicalExample: '현장체험학습 신청 시 비상연락처 등 개인정보 이용에 동의하는 서류에 서명합니다.',
    parentChecklist: ['수집 목적', '보유 기간', '서명 여부'],
    parentActions: ['내용을 확인한 뒤 동의 여부를 결정하고 서명합니다.'],
    commonMisunderstandings: ['서명하지 않으면 무조건 불이익이 있다고 오해하는 경우가 있으나 목적별로 다릅니다.'],
    schoolConfirmationNeeded: ['동의하지 않을 경우의 처리 방법'],
  },
  {
    term: '현장체험학습',
    aliases: [],
    easyMeaning: '학급이나 학년 전체가 학교 밖으로 나가 진행하는 단체 체험학습입니다.',
    practicalExample: '박물관이나 체험관으로 학급 전체가 함께 이동해 학습하는 활동입니다.',
    parentChecklist: ['참가비', '준비물', '동의서 제출 여부'],
    parentActions: ['동의서에 서명하고 참가비를 납부 기한 내에 냅니다.'],
    commonMisunderstandings: ['선택 활동이라고 생각하지만 학교 교육과정의 일부인 경우가 많습니다.'],
    schoolConfirmationNeeded: ['불참 시 처리 방법'],
  },
  {
    term: '준비물',
    aliases: [],
    easyMeaning: '수업이나 활동을 위해 아이가 학교에 가져가야 하는 물건입니다.',
    practicalExample: '색연필, 줄넘기, 우유갑처럼 특정 수업에 필요한 물건입니다.',
    parentChecklist: ['품목', '수량', '준비 기한'],
    parentActions: ['목록에 맞춰 준비물을 챙겨줍니다.'],
    commonMisunderstandings: ['모든 준비물을 새로 사야 한다고 오해하는 경우가 있지만 집에 있는 물건으로 대체 가능한 경우도 많습니다.'],
    schoolConfirmationNeeded: ['대체 가능 여부'],
  },
  {
    term: '가정학습',
    aliases: ['가정 학습'],
    easyMeaning: '정해진 기간 동안 학교 대신 집에서 학습하도록 허가받는 제도입니다.',
    practicalExample: '개인 사정으로 등교가 어려울 때 학교에 신청해 며칠간 가정에서 학습할 수 있습니다.',
    parentChecklist: ['허용 일수', '신청 절차', '학습 결과물 제출 여부'],
    parentActions: ['사전에 담임교사와 상의하고 신청서를 제출합니다.'],
    commonMisunderstandings: ['횟수 제한 없이 자유롭게 사용할 수 있다고 오해하는 경우가 있습니다.'],
    schoolConfirmationNeeded: ['연간 허용 일수와 승인 절차'],
  },
  {
    term: '재량휴업일',
    aliases: [],
    easyMeaning: '학교장이 학사일정에 따라 학교 재량으로 정하는 휴업일입니다.',
    practicalExample: '학교 사정에 따라 특정 요일을 학교장 재량으로 쉬는 날로 정하는 경우입니다.',
    parentChecklist: ['해당 날짜', '돌봄교실 운영 여부'],
    parentActions: ['해당 날짜의 아이 돌봄 계획을 미리 세웁니다.'],
    commonMisunderstandings: ['전국 모든 학교가 같은 날 쉰다고 오해하는 경우가 있지만 학교마다 다릅니다.'],
    schoolConfirmationNeeded: ['재량휴업일에 돌봄교실 운영 여부'],
  },
];

const GLOSSARY_INDEX = new Map<string, GlossaryEntry>();
for (const entry of GLOSSARY_ENTRIES) {
  GLOSSARY_INDEX.set(normalizeTerm(entry.term), entry);
  for (const alias of entry.aliases) {
    GLOSSARY_INDEX.set(normalizeTerm(alias), entry);
  }
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, '');
}

export function lookupGlossaryTerm(term: string): GlossaryEntry | null {
  return GLOSSARY_INDEX.get(normalizeTerm(term)) ?? null;
}

export function listGlossaryTerms(): string[] {
  return GLOSSARY_ENTRIES.map((e) => e.term);
}
