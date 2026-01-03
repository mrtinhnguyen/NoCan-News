import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterService } from '../../src/modules/newsletter/newsletter.service';
import { RssService } from '../../src/modules/rss/rss.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { EmailService } from '../../src/modules/email/email.service';
import { ScraperService } from '../../src/modules/scraper/scraper.service';
import { MockAiService } from '../mocks/mock-ai.service';
import { MockRssService } from '../mocks/mock-rss.service';
import { MockScraperService } from '../mocks/mock-scraper.service';
import { MockEmailService } from '../mocks/mock-email.service';

export interface ScenarioConfig {
  name: string;
  mocks: {
    rss: { scenario: 'success' | 'insufficient'; noEditorials?: boolean };
    ai: {
      selectionMode: 'success' | 'insufficient';
      insightFailureRate: number;
    };
    scraper: { successRate: number };
  };
  expectedResult?: {
    qualityGatePassed?: boolean | null;
    failureReason?: string;
    emailSent?: boolean;
    editorialSynthesis?: any;
  };
}

export async function runScenario(config: ScenarioConfig) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Scenario: ${config.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // NestJS 테스트 모듈 생성
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NewsletterService,
      { provide: AiService, useClass: MockAiService },
      { provide: RssService, useClass: MockRssService },
      { provide: ScraperService, useClass: MockScraperService },
      { provide: EmailService, useClass: MockEmailService },
    ],
  }).compile();

  const newsletterService = module.get<NewsletterService>(NewsletterService);
  const mockAi = module.get<MockAiService>(AiService);
  const mockRss = module.get<MockRssService>(RssService);
  const mockScraper = module.get<MockScraperService>(ScraperService);

  // Mock 설정
  mockRss.setScenario(config.mocks.rss.scenario);
  mockAi.setSelectionMode(config.mocks.ai.selectionMode);
  mockAi.setInsightFailureRate(config.mocks.ai.insightFailureRate);
  mockScraper.setSuccessRate(config.mocks.scraper.successRate);

  console.log(`⚙️  Mock Configuration:`);
  console.log(`   RSS Scenario: ${config.mocks.rss.scenario}`);
  console.log(`   AI Selection: ${config.mocks.ai.selectionMode}`);
  console.log(
    `   Insight Failure Rate: ${config.mocks.ai.insightFailureRate * 100}%`,
  );
  console.log(
    `   Scraping Success Rate: ${config.mocks.scraper.successRate * 100}%\n`,
  );

  // 시나리오 실행
  try {
    await newsletterService.run();
  } catch (error) {
    console.error(`\n❌ Error during scenario execution:`, error.message);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Scenario "${config.name}" completed\n`);
}
