import {
  EditorialSynthesis,
  InsightResult,
  SelectionResult,
} from '../../src/common/interfaces';

/**
 * AI 선별 응답 (독성 필터)
 */
export const mockAiSelection = {
  // 정상 케이스: 12개 선택, 일부 차단
  success: (newsCount: number): SelectionResult => ({
    filterStats: {
      scanned: newsCount,
      blocked: { crime: 2, gossip: 3, politicalStrife: 1 },
    },
    selectedIndices: [0, 1, 2], // 3개 선택
  }),

  // 부족 케이스: 선택된 뉴스가 적음
  insufficient: (newsCount: number): SelectionResult => ({
    filterStats: {
      scanned: newsCount,
      blocked: { crime: 5, gossip: 8, politicalStrife: 4 },
    },
    selectedIndices: [0], // 1개만 선택
  }),
};

/**
 * AI 인사이트 생성 응답
 */
export const mockInsights = {
  // 정상 케이스: 모든 인사이트 성공
  success: (newsTitle: string): InsightResult => ({
    detoxedTitle: `[AI 중화] ${newsTitle.replace(/!/g, '.').replace(/\?/g, '.')}`,
    insight: {
      fact: 'Mock fact about the news',
      context: 'Mock context about the news',
      implication: 'Mock implication about the news',
    },
  }),

  // 실패 케이스: null 반환 (API 에러 시뮬레이션)
  failure: (): InsightResult | null => null,
};

/**
 * 사설 통합 분석 응답
 */
export const mockEditorialSynthesis: EditorialSynthesis = {
  topic: '반도체 산업 육성 방안',
  conflict: '정부의 반도체 지원법 처리 지연을 둘러싼 입장 차이',
  argumentA: '기업 지원 확대와 규제 완화를 통한 경쟁력 강화 필요',
  argumentB: '공정한 지원과 노동자 보호를 병행한 지속 가능한 성장 필요',
  synthesis:
    '글로벌 반도체 공급망 재편 속에서 경쟁력 유지와 사회적 형평성을 동시에 고려해야 하는 구조적 딜레마',
};
