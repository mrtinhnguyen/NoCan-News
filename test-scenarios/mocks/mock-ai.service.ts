import { Injectable } from '@nestjs/common';
import { NewsItem, ScrapedNews } from '../../src/common/interfaces';
import {
  mockAiSelection,
  mockEditorialSynthesis,
  mockInsights,
} from '../fixtures/ai-responses.fixture';

@Injectable()
export class MockAiService {
  private selectionMode: 'success' | 'insufficient' = 'success';
  private insightFailureRate: number = 0; // 0.0 ~ 1.0

  setSelectionMode(mode: 'success' | 'insufficient') {
    this.selectionMode = mode;
  }

  setInsightFailureRate(rate: number) {
    this.insightFailureRate = rate;
  }

  selectNewsForCategory(items: NewsItem[], category: string) {
    console.log(`[MockAiService] selectNewsForCategory (${category})`);
    return mockAiSelection[this.selectionMode](items.length);
  }

  aggregateFilterStats(results: any[]) {
    // 실제 로직과 동일
    const stats = {
      totalScanned: 0,
      blocked: { crime: 0, gossip: 0, politicalStrife: 0 },
    };
    results.forEach((r) => {
      stats.totalScanned += r.filterStats.scanned;
      stats.blocked.crime += r.filterStats.blocked.crime;
      stats.blocked.gossip += r.filterStats.blocked.gossip;
      stats.blocked.politicalStrife += r.filterStats.blocked.politicalStrife;
    });
    return stats;
  }

  generateInsights(news: ScrapedNews[]) {
    console.log(
      `[MockAiService] generateInsights (failure rate: ${this.insightFailureRate})`,
    );

    return news.map((item) => {
      // 실패율에 따라 일부를 null로 반환
      const shouldFail = Math.random() < this.insightFailureRate;
      return shouldFail
        ? mockInsights.failure()
        : mockInsights.success(item.title);
    });
  }

  matchEditorials(conservative: any[], liberal: any[]) {
    console.log(`[MockAiService] matchEditorials`);
    if (conservative.length === 0 || liberal.length === 0) {
      return null;
    }
    return {
      conservativeIdx: 0,
      liberalIdx: 0,
      topic: '반도체 산업 육성',
    };
  }

  synthesizeEditorials(consContent: string, libContent: string, topic: string) {
    console.log(`[MockAiService] synthesizeEditorials (${topic})`);
    return mockEditorialSynthesis;
  }

  generateProtectionLog(stats: any) {
    return `오늘 AI가 ${stats.totalScanned}건을 스캔하여 총 ${
      stats.blocked.crime + stats.blocked.gossip + stats.blocked.politicalStrife
    }건을 차단했습니다.`;
  }
}
