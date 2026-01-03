/**
 * 시나리오 2: 뉴스 부족으로 발송 중단
 *
 * - RSS 수집: 일부 카테고리 뉴스 부족
 * - AI 선별: 소수만 선택
 * - 스크래핑: 80% 성공
 * - AI 인사이트: 30% 실패 (일부 기사 제외)
 * - 최종 뉴스: 6개 (< 8개)
 * - 품질 게이트: ❌ FAILED (Insufficient news count)
 * - 이메일 발송: ❌ 중단
 */

import { runScenario } from '../utils/scenario-runner';

export async function scenario2() {
  console.log('\n🎯 Scenario 2: 뉴스 부족으로 발송 중단\n');

  await runScenario({
    name: '뉴스 부족',
    mocks: {
      rss: { scenario: 'insufficient' },
      ai: { selectionMode: 'insufficient', insightFailureRate: 0.3 },
      scraper: { successRate: 0.8 },
    },
    expectedResult: {
      qualityGatePassed: false,
      failureReason: 'Insufficient news count',
      emailSent: false,
    },
  });
}
