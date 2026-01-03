#!/usr/bin/env ts-node

/**
 * 테스트 시나리오 실행기
 *
 * Usage:
 *   npm run scenario 1        # 시나리오 1 실행
 *   npm run scenario all      # 모든 시나리오 실행
 */

import { scenario1 } from './scenarios/scenario-1-success';
import { scenario2 } from './scenarios/scenario-2-insufficient-news';
import { scenario3 } from './scenarios/scenario-3-low-scraping-rate';
import { scenario4 } from './scenarios/scenario-4-insight-failures';
import { scenario5 } from './scenarios/scenario-5-editorial-missing';

const scenarios = {
  '1': { name: '정상 발송', fn: scenario1 },
  '2': { name: '뉴스 부족', fn: scenario2 },
  '3': { name: '스크래핑 실패', fn: scenario3 },
  '4': { name: 'AI 인사이트 실패', fn: scenario4 },
  '5': { name: '사설 누락', fn: scenario5 },
};

async function main() {
  const args = process.argv.slice(2);
  const scenarioId = args[0];

  if (!scenarioId) {
    console.log('Usage: npm run scenario <number|all>');
    console.log('\nAvailable scenarios:');
    Object.entries(scenarios).forEach(([id, { name }]) => {
      console.log(`  ${id}: ${name}`);
    });
    console.log('  all: Run all scenarios');
    process.exit(1);
  }

  if (scenarioId === 'all') {
    console.log('🚀 Running all scenarios...\n');
    for (const [id, { fn }] of Object.entries(scenarios)) {
      await fn();
      console.log('\n');
    }
  } else if (scenarios[scenarioId]) {
    await scenarios[scenarioId].fn();
  } else {
    console.error(`❌ Unknown scenario: ${scenarioId}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
