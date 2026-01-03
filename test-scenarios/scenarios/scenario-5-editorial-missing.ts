/**
 * 시나리오 5: 사설 없음 (정상 발송)
 *
 * - RSS 수집: 충분한 뉴스
 * - AI 선별: 12개 선택
 * - 스크래핑: 100% 성공
 * - AI 인사이트: 100% 성공
 * - 사설: 매칭 실패 (선택 사항이므로 발송 계속)
 * - 품질 게이트: ✅ PASSED
 * - 이메일 발송: ✅ 성공 (사설 섹션 없이)
 */

import { runScenario } from '../utils/scenario-runner';

export async function scenario5() {
  console.log('\n🎯 Scenario 5: 사설 없음 (정상 발송)\n');

  await runScenario({
    name: '사설 누락',
    mocks: {
      rss: { scenario: 'success', noEditorials: true },
      ai: { selectionMode: 'success', insightFailureRate: 0 },
      scraper: { successRate: 1.0 },
    },
    expectedResult: {
      qualityGatePassed: true,
      emailSent: true,
      editorialSynthesis: undefined,
    },
  });
}
