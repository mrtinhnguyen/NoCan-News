/**
 * 시나리오 3: 스크래핑 실패율 높아 발송 중단
 *
 * - RSS 수집: 충분한 뉴스
 * - AI 선별: 12개 선택
 * - 스크래핑: 50% 성공 (< 60%)
 * - 품질 게이트: ❌ FAILED (Low scraping success rate)
 * - 이메일 발송: ❌ 중단
 */

import { runScenario } from '../utils/scenario-runner';

export async function scenario3() {
  console.log('\n🎯 Scenario 3: 스크래핑 실패율 높아 발송 중단\n');

  await runScenario({
    name: '스크래핑 실패',
    mocks: {
      rss: { scenario: 'success' },
      ai: { selectionMode: 'success', insightFailureRate: 0 },
      scraper: { successRate: 0.5 },
    },
    expectedResult: {
      qualityGatePassed: false,
      failureReason: 'Low scraping success rate',
      emailSent: false,
    },
  });
}
