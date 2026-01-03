/**
 * 시나리오 1: 정상 발송
 *
 * - RSS 수집: 각 카테고리 충분한 뉴스
 * - AI 선별: 12개 선택
 * - 스크래핑: 100% 성공
 * - AI 인사이트: 100% 성공
 * - 사설: 매칭 및 통합 성공
 * - 품질 게이트: ✅ PASSED
 * - 이메일 발송: ✅ 성공
 */

import { runScenario } from '../utils/scenario-runner';

export async function scenario1() {
  console.log('\n🎯 Scenario 1: 정상 발송\n');

  await runScenario({
    name: '정상 발송',
    mocks: {
      rss: { scenario: 'success' },
      ai: { selectionMode: 'success', insightFailureRate: 0 },
      scraper: { successRate: 1.0 },
    },
    expectedResult: {
      qualityGatePassed: true,
      emailSent: true,
    },
  });
}
