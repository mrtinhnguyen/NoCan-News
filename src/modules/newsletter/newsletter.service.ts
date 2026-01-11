import { Injectable, Logger } from '@nestjs/common';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { NewsCategory } from '../../common/constants';
import {
  CategorizedNews,
  Editorial,
  EditorialSynthesis,
  InsightResult,
  NewsItem,
  NewsletterData,
  ProcessedNews,
  ScrapedNews,
  SelectionResult,
} from '../../common/interfaces';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { SelectionReportService } from '../report/selection-report.service';
import { RssService } from '../rss/rss.service';
import { ScraperService } from '../scraper/scraper.service';

interface CategoryData {
  key: NewsCategory;
  items: NewsItem[];
}

interface NewsletterMetrics {
  rss: {
    totalScanned: number;
    byCategory: Record<NewsCategory, number>;
  };
  aiSelection: {
    totalFiltered: number;
    toxicBlocked: {
      crime: number;
      gossip: number;
      politicalStrife: number;
    };
    selected: number;
  };
  scraping: {
    attempted: number;
    succeeded: number;
    successRate: number;
  };
  insights: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
  editorial: {
    matchFound: boolean;
    synthesisSuccess: boolean;
  };
  final: {
    newsCount: number;
    qualityGatePassed: boolean;
    failureReason?: string;
  };
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly rssService: RssService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
    private readonly scraperService: ScraperService,
    private readonly selectionReportService: SelectionReportService,
    private readonly devModeConfig: DevModeConfig,
  ) {}

  /**
   * 뉴스레터 생성 및 발송 메인 프로세스
   *
   * Flow (플랜 기반):
   * 1. RSS 수집 (~310건)
   * 2. AI 선별 (카테고리별 4회 병렬 호출 → 12개 선택)
   * 3. 본문 스크래핑 (cheerio)
   * 4. AI 처리 (제목 중화 + 인사이트 생성 1회 호출)
   * 5. HTML 렌더링 및 이메일 발송
   */
  async run(): Promise<void> {
    // DEV MODE: 시작 배너 출력
    this.devModeConfig.printBanner();

    this.logger.log('=== NoCan News Newsletter Generation Started ===');

    const metrics: NewsletterMetrics = {
      rss: { totalScanned: 0, byCategory: {} as Record<NewsCategory, number> },
      aiSelection: {
        totalFiltered: 0,
        toxicBlocked: { crime: 0, gossip: 0, politicalStrife: 0 },
        selected: 0,
      },
      scraping: { attempted: 0, succeeded: 0, successRate: 0 },
      insights: { attempted: 0, succeeded: 0, failed: 0 },
      editorial: { matchFound: false, synthesisSuccess: false },
      final: { newsCount: 0, qualityGatePassed: false },
    };

    try {
      // Step 1: RSS 피드 수집
      this.logger.log('Step 1: Collecting RSS feeds...');
      const categorizedNews = await this.rssService.fetchAllCategories();

      // 메트릭 기록
      metrics.rss.byCategory.business = categorizedNews.business.length;
      metrics.rss.byCategory.tech = categorizedNews.tech.length;
      metrics.rss.byCategory.society = categorizedNews.society.length;
      metrics.rss.byCategory.world = categorizedNews.world.length;
      metrics.rss.totalScanned =
        categorizedNews.business.length +
        categorizedNews.tech.length +
        categorizedNews.society.length +
        categorizedNews.world.length;

      // Step 2: AI 선별 (카테고리별 병렬 처리)
      this.logger.log('Step 2: AI selecting news from each category...');
      const categories: CategoryData[] = [
        { key: 'business', items: categorizedNews.business },
        { key: 'tech', items: categorizedNews.tech },
        { key: 'society', items: categorizedNews.society },
        { key: 'world', items: categorizedNews.world },
      ];

      const selectionPromises: Promise<SelectionResult>[] = categories.map(
        (cat: CategoryData) =>
          this.aiService.selectNewsForCategory(cat.items, cat.key),
      );
      const selectionResults: SelectionResult[] =
        await Promise.all(selectionPromises);

      // DEV MODE: AI 선별 리포트 생성
      if (this.devModeConfig.isDevMode) {
        const selectionResultMap = new Map<NewsCategory, SelectionResult>();
        categories.forEach((cat, idx) => {
          selectionResultMap.set(cat.key, selectionResults[idx]);
        });

        const reportHtml = this.selectionReportService.generateReport(
          categorizedNews as CategorizedNews,
          selectionResultMap,
        );
        const reportPath = this.selectionReportService.saveReport(reportHtml);
        this.logger.log(`📊 Selection report generated: ${reportPath}`);
      }

      // 선별된 뉴스 추출
      const selectedNews: NewsItem[] = [];

      for (let i = 0; i < categories.length; i++) {
        const categoryItems: NewsItem[] = categories[i].items;
        const result: SelectionResult = selectionResults[i];

        for (const index of result.selectedIndices) {
          const newsItem: NewsItem | undefined = categoryItems[index];
          if (newsItem) {
            selectedNews.push(newsItem);
          }
        }
      }

      this.logger.log(`Selected ${selectedNews.length} news items`);

      // 통합 필터 통계
      const filterStats = this.aiService.aggregateFilterStats(selectionResults);
      this.logger.log(
        `Filter stats: scanned=${filterStats.totalScanned}, blocked=${
          filterStats.blocked.crime +
          filterStats.blocked.gossip +
          filterStats.blocked.politicalStrife
        }`,
      );

      // 메트릭 기록
      metrics.aiSelection.totalFiltered = filterStats.totalScanned;
      metrics.aiSelection.toxicBlocked = filterStats.blocked;
      metrics.aiSelection.selected = selectedNews.length;

      // Step 3: 본문 스크래핑
      this.logger.log('Step 3: Scraping article contents...');
      const allScrapedNews: ScrapedNews[] =
        await this.scraperService.scrapeMultipleArticles(selectedNews);

      // 메트릭 기록
      metrics.scraping.attempted = selectedNews.length;
      metrics.scraping.succeeded = allScrapedNews.length;
      metrics.scraping.successRate =
        selectedNews.length > 0
          ? (allScrapedNews.length / selectedNews.length) * 100
          : 0;

      // 카테고리별 상위 3개로 제한
      const scrapedNews: ScrapedNews[] = this.limitByCategory(
        allScrapedNews,
        3,
      );
      this.logger.log(
        `Limited to ${scrapedNews.length} news (3 per category max)`,
      );

      // Step 4: AI 인사이트 생성
      this.logger.log('Step 4: Generating insights...');
      const insights: InsightResult[] =
        await this.aiService.generateInsights(scrapedNews);

      // 메트릭 기록 + 실패한 기사 제외
      metrics.insights.attempted = scrapedNews.length;

      const processedNews: ProcessedNews[] = [];
      for (let i = 0; i < scrapedNews.length; i++) {
        const news: ScrapedNews = scrapedNews[i];
        const insight: InsightResult | undefined = insights[i];

        // AI 인사이트가 성공한 경우만 포함
        if (insight && insight.detoxedTitle) {
          processedNews.push({
            original: news,
            isToxic: false,
            rewrittenTitle: insight.detoxedTitle,
            insight: insight.insight,
          });
          metrics.insights.succeeded++;
        } else {
          // 실패한 경우 제외
          metrics.insights.failed++;
          this.logger.warn(
            `Insight generation failed for: ${news.title} - excluding from newsletter`,
          );
        }
      }

      this.logger.log(
        `Final news count after insight filtering: ${processedNews.length}`,
      );

      // Step 5: 사설 통합 분석
      this.logger.log('Step 5: Processing editorials...');
      let editorialSynthesis: EditorialSynthesis | undefined;

      // 5-1. 보수/진보 사설 수집
      const [conservative, liberal]: [Editorial[], Editorial[]] =
        await Promise.all([
          this.rssService.fetchEditorials('conservative'),
          this.rssService.fetchEditorials('liberal'),
        ]);

      // 5-2. AI 매칭 (같은 주제 찾기)
      const match = await this.aiService.matchEditorials(conservative, liberal);
      metrics.editorial.matchFound = !!match;

      if (match) {
        // 5-3. 매칭된 사설 스크래핑
        const [consContent, libContent] = await Promise.all([
          this.scraperService.scrapeArticle(
            conservative[match.conservativeIdx].link,
          ),
          this.scraperService.scrapeArticle(liberal[match.liberalIdx].link),
        ]);

        // 5-4. AI 통합 분석
        if (consContent && libContent) {
          editorialSynthesis = await this.aiService.synthesizeEditorials(
            consContent,
            libContent,
            match.topic,
          );
          metrics.editorial.synthesisSuccess = true;
          this.logger.log(`Editorial synthesis completed: ${match.topic}`);
        } else {
          this.logger.warn('Failed to scrape editorial contents');
        }
      } else {
        this.logger.log('No matching editorial pair found for today');
      }

      // Step 5.5: 품질 게이트 검증
      this.logger.log('Step 5.5: Validating quality gate...');

      metrics.final.newsCount = processedNews.length;

      // 기준 1: 최소 뉴스 개수 (8개)
      const MIN_NEWS_COUNT = 8;
      if (processedNews.length < MIN_NEWS_COUNT) {
        metrics.final.qualityGatePassed = false;
        metrics.final.failureReason = `Insufficient news count: ${processedNews.length} < ${MIN_NEWS_COUNT}`;
        this.logMetrics(metrics);
        this.logger.error(
          `❌ Quality Gate Failed: ${metrics.final.failureReason}`,
        );
        this.logger.warn('Newsletter generation aborted - not sending email');
        return;
      }

      // 기준 2: 스크래핑 성공률 (60%)
      const MIN_SCRAPING_SUCCESS_RATE = 60;
      if (metrics.scraping.successRate < MIN_SCRAPING_SUCCESS_RATE) {
        metrics.final.qualityGatePassed = false;
        metrics.final.failureReason = `Low scraping success rate: ${metrics.scraping.successRate.toFixed(1)}% < ${MIN_SCRAPING_SUCCESS_RATE}%`;
        this.logMetrics(metrics);
        this.logger.error(
          `❌ Quality Gate Failed: ${metrics.final.failureReason}`,
        );
        this.logger.warn('Newsletter generation aborted - not sending email');
        return;
      }

      // 품질 게이트 통과
      metrics.final.qualityGatePassed = true;
      this.logger.log('✅ Quality Gate Passed');

      // Step 6: 뉴스레터 데이터 구성
      this.logger.log('Step 6: Building newsletter data...');
      const koreaDate = new Date()
        .toLocaleDateString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\. /g, '-')
        .replace('.', '');

      const newsletterData: NewsletterData = {
        date: koreaDate,
        protectionLog: this.aiService.generateProtectionLog(filterStats),
        processedNews,
        editorialSynthesis,
      };

      // Step 7: HTML 렌더링 및 프리뷰
      this.logger.log('Step 7: Rendering newsletter...');
      const html = this.emailService.renderNewsletter(newsletterData);

      // 프리뷰 로깅 (이메일 발송은 제외)
      this.logger.log('--- Newsletter Preview ---');
      this.logger.log(`Date: ${newsletterData.date}`);
      this.logger.log(`Protection Log: ${newsletterData.protectionLog}`);
      this.logger.log(`News Count: ${processedNews.length}`);
      for (let i = 0; i < processedNews.length; i++) {
        const news: ProcessedNews = processedNews[i];
        this.logger.log(
          `[${i + 1}] ${news.original.category}: ${news.rewrittenTitle}`,
        );
      }
      if (editorialSynthesis) {
        this.logger.log(`Editorial Topic: ${editorialSynthesis.topic}`);
      }
      this.logger.log(`HTML Length: ${html.length} characters`);

      // Step 7: Email Sending
      this.logger.log('Step 7: Sending newsletter email...');

      // Check dry-run mode (DEV_MODE or NEWSLETTER_DRY_RUN)
      if (this.devModeConfig.skipEmail) {
        if (this.devModeConfig.isDevMode) {
          this.logger.warn('[DEV] Email sending disabled in dev mode');
        } else {
          this.logger.warn('🔴 DRY-RUN MODE: Email sending disabled');
        }
        this.logger.log(
          'To enable email sending, set NEWSLETTER_DRY_RUN=false and DEV_MODE=false',
        );
      } else {
        try {
          const recipients = await this.emailService.getRecipients();

          if (recipients.length === 0) {
            this.logger.warn(
              '⚠️ No active subscribers found. Skipping email send.',
            );
          } else {
            const emailList = recipients.map((r) => r.email).join(', ');
            this.logger.log(
              `📤 Sending to ${recipients.length} recipient(s): ${emailList}`,
            );

            await this.emailService.sendNewsletter(recipients, html);

            this.logger.log(`✅ Newsletter sending completed`);
            this.logger.log(
              `📊 Email size: ${(html.length / 1024).toFixed(2)} KB`,
            );
          }
        } catch (error) {
          this.logger.error('❌ Failed to send newsletter email', error);
          this.logger.warn(
            '⚠️ Newsletter generation completed but email delivery failed',
          );
          this.logger.warn(
            'Consider checking Gmail credentials and recipient addresses',
          );
          // Don't re-throw - email failure shouldn't break the entire pipeline
        }
      }

      // Step 8: 최종 메트릭 출력
      this.logMetrics(metrics);

      this.logger.log('=== NoCan News Newsletter Generation Completed ===');
    } catch (error) {
      this.logger.error('Newsletter generation failed', error);
      this.logMetrics(metrics);
      throw error;
    }
  }

  /**
   * 카테고리별 최대 N개로 제한
   */
  private limitByCategory(news: ScrapedNews[], limit: number): ScrapedNews[] {
    const countByCategory: Record<string, number> = {};
    const result: ScrapedNews[] = [];

    for (const item of news) {
      const cat = item.category;
      const currentCount = countByCategory[cat] || 0;

      if (currentCount < limit) {
        result.push(item);
        countByCategory[cat] = currentCount + 1;
      }
    }

    return result;
  }

  /**
   * 메트릭을 로그로 출력
   */
  private logMetrics(metrics: NewsletterMetrics): void {
    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📊 Newsletter Generation Metrics');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // RSS 수집
    this.logger.log('');
    this.logger.log('📰 RSS Collection:');
    this.logger.log(`   Total Scanned: ${metrics.rss.totalScanned}`);
    this.logger.log(`   Business: ${metrics.rss.byCategory.business || 0}`);
    this.logger.log(`   Tech: ${metrics.rss.byCategory.tech || 0}`);
    this.logger.log(`   Society: ${metrics.rss.byCategory.society || 0}`);
    this.logger.log(`   World: ${metrics.rss.byCategory.world || 0}`);

    // AI 선별 (독성 필터)
    this.logger.log('');
    this.logger.log('🤖 AI Selection (Toxicity Filter):');
    this.logger.log(`   Total Filtered: ${metrics.aiSelection.totalFiltered}`);
    this.logger.log(
      `   Toxic Blocked: ${
        metrics.aiSelection.toxicBlocked.crime +
        metrics.aiSelection.toxicBlocked.gossip +
        metrics.aiSelection.toxicBlocked.politicalStrife
      } (Crime: ${metrics.aiSelection.toxicBlocked.crime}, Gossip: ${
        metrics.aiSelection.toxicBlocked.gossip
      }, Political: ${metrics.aiSelection.toxicBlocked.politicalStrife})`,
    );
    this.logger.log(`   Selected: ${metrics.aiSelection.selected}`);

    // 스크래핑
    this.logger.log('');
    this.logger.log('📄 Scraping:');
    this.logger.log(`   Attempted: ${metrics.scraping.attempted}`);
    this.logger.log(`   Succeeded: ${metrics.scraping.succeeded}`);
    this.logger.log(
      `   Success Rate: ${metrics.scraping.successRate.toFixed(1)}%`,
    );

    // AI 인사이트
    this.logger.log('');
    this.logger.log('💡 AI Insights:');
    this.logger.log(`   Attempted: ${metrics.insights.attempted}`);
    this.logger.log(`   Succeeded: ${metrics.insights.succeeded}`);
    this.logger.log(`   Failed (Excluded): ${metrics.insights.failed}`);

    // 사설
    this.logger.log('');
    this.logger.log('📝 Editorial Analysis:');
    this.logger.log(
      `   Match Found: ${metrics.editorial.matchFound ? 'Yes' : 'No'}`,
    );
    if (metrics.editorial.matchFound) {
      this.logger.log(
        `   Synthesis Success: ${metrics.editorial.synthesisSuccess ? 'Yes' : 'No'}`,
      );
    }

    // 최종 결과
    this.logger.log('');
    this.logger.log('✨ Final Result:');
    this.logger.log(`   News Count: ${metrics.final.newsCount}`);
    this.logger.log(
      `   Quality Gate: ${metrics.final.qualityGatePassed ? '✅ PASSED' : '❌ FAILED'}`,
    );
    if (metrics.final.failureReason) {
      this.logger.log(`   Failure Reason: ${metrics.final.failureReason}`);
    }

    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
  }
}
