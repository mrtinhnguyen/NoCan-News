/**
 * 시나리오 4: AI 인사이트 일부 실패
 *
 * - RSS 수집: 충분한 뉴스
 * - AI 선별: 12개 선택
 * - 스크래핑: 100% 성공 (12개)
 * - AI 인사이트: 40% 실패 (4-5개 실패)
 * - 최종 뉴스: 7-8개 (경계 케이스)
 * - 품질 게이트: ⚠️ 운에 따라 통과/실패
 */

import { runScenario } from '../utils/scenario-runner';

export async function scenario4() {
  console.log('\n🎯 Scenario 4: AI 인사이트 일부 실패 (경계 케이스)\n');

  await runScenario({
    name: 'AI 인사이트 실패',
    mocks: {
      rss: { scenario: 'success' },
      ai: { selectionMode: 'success', insightFailureRate: 0.4 },
      scraper: { successRate: 1.0 },
    },
    expectedResult: {
      // 랜덤 실패이므로 결과가 달라질 수 있음
      qualityGatePassed: null, // 검증 안 함
    },
  });
}
