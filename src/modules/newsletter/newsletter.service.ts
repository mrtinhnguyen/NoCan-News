import { Injectable, Logger } from '@nestjs/common';
import { NewsCategory } from '../../common/constants';
import {
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
import { RssService } from '../rss/rss.service';
import { ScraperService } from '../scraper/scraper.service';

interface CategoryData {
  key: NewsCategory;
  items: NewsItem[];
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly rssService: RssService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
    private readonly scraperService: ScraperService,
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
    this.logger.log('=== NoCan News Newsletter Generation Started ===');

    try {
      // Step 1: RSS 피드 수집
      this.logger.log('Step 1: Collecting RSS feeds...');
      const categorizedNews = await this.rssService.fetchAllCategories();

      // Step 2: AI 선별 (카테고리별 병렬 처리)
      this.logger.log('Step 2: AI selecting news from each category...');
      const categories: CategoryData[] = [
        { key: 'business', items: categorizedNews.business },
        { key: 'tech', items: categorizedNews.tech },
        { key: 'policy', items: categorizedNews.policy },
        { key: 'world', items: categorizedNews.world },
      ];

      const selectionPromises: Promise<SelectionResult>[] = categories.map(
        (cat: CategoryData) =>
          this.aiService.selectNewsForCategory(cat.items, cat.key),
      );
      const selectionResults: SelectionResult[] =
        await Promise.all(selectionPromises);

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

      // Step 3: 본문 스크래핑
      this.logger.log('Step 3: Scraping article contents...');
      const allScrapedNews: ScrapedNews[] =
        await this.scraperService.scrapeMultipleArticles(selectedNews);

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

      // ProcessedNews 형태로 변환
      const processedNews: ProcessedNews[] = [];
      for (let i = 0; i < scrapedNews.length; i++) {
        const news: ScrapedNews = scrapedNews[i];
        const insight: InsightResult | undefined = insights[i];
        processedNews.push({
          original: news,
          isToxic: false,
          rewrittenTitle: insight?.detoxedTitle ?? news.title,
          insight: insight?.insight,
        });
      }

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
          this.logger.log(`Editorial synthesis completed: ${match.topic}`);
        } else {
          this.logger.warn('Failed to scrape editorial contents');
        }
      } else {
        this.logger.log('No matching editorial pair found for today');
      }

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

      // Check dry-run mode
      const isDryRun = process.env.NEWSLETTER_DRY_RUN === 'true';
      if (isDryRun) {
        this.logger.warn('🔴 DRY-RUN MODE: Email sending disabled');
        this.logger.log(
          'To enable email sending, set NEWSLETTER_DRY_RUN=false',
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

      this.logger.log('=== NoCan News Newsletter Generation Completed ===');
    } catch (error) {
      this.logger.error('Newsletter generation failed', error);
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
}
