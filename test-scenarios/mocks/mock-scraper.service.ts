import { Injectable } from '@nestjs/common';
import {
  createScrapingResults,
  mockEditorialContent,
} from '../fixtures/scraping-results.fixture';

@Injectable()
export class MockScraperService {
  private successRate: number = 1.0; // 100% 성공

  setSuccessRate(rate: number) {
    this.successRate = rate;
  }

  async scrapeMultipleArticles(newsItems: any[]) {
    console.log(
      `[MockScraperService] scrapeMultipleArticles (success rate: ${this.successRate})`,
    );
    await this.simulateDelay(500); // 0.5초 지연 (실제 스크래핑 시뮬레이션)
    return createScrapingResults(newsItems, this.successRate);
  }

  async scrapeArticle(url: string) {
    console.log(`[MockScraperService] scrapeArticle (${url})`);
    await this.simulateDelay(200);

    if (url.includes('conservative')) {
      return mockEditorialContent.conservative;
    } else if (url.includes('liberal')) {
      return mockEditorialContent.liberal;
    }
    return null;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
