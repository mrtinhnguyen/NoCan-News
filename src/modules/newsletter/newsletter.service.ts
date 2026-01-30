import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { NewsCategory } from '../../common/constants';
import {
  ContentData,
  Editorial,
  EditorialSynthesis,
  FilterStats,
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
import { SupabaseService } from '../supabase/supabase.service';

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
    fallback: number;
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
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Quy trình tạo và gửi bản tin chính
   *
   * Flow (dựa trên kế hoạch):
   * 1. Thu thập RSS (~310 tin)
   * 2. Chọn lọc AI (4 cuộc gọi song song theo danh mục → chọn 12 tin)
   * 3. Cào nội dung bài viết (cheerio)
   * 4. Xử lý AI (trung hòa tiêu đề + tạo insight 1 cuộc gọi)
   * 5. Render HTML và gửi email
   */
  async run(): Promise<void> {
    // DEV MODE: In banner khởi động
    this.devModeConfig.printBanner();

    this.logger.log('=== Bắt đầu tạo bản tin Morning News ===');

    const metrics: NewsletterMetrics = {
      rss: { totalScanned: 0, byCategory: {} as Record<NewsCategory, number> },
      aiSelection: {
        totalFiltered: 0,
        toxicBlocked: { crime: 0, gossip: 0, politicalStrife: 0 },
        selected: 0,
      },
      scraping: { attempted: 0, succeeded: 0, successRate: 0 },
      insights: { attempted: 0, succeeded: 0, fallback: 0, failed: 0 },
      editorial: { matchFound: false, synthesisSuccess: false },
      final: { newsCount: 0, qualityGatePassed: false },
    };

    try {
      // Bước 1: Thu thập RSS feed
      this.logger.log('Bước 1: Đang thu thập RSS feed...');
      const categorizedNews = await this.rssService.fetchAllCategories();

      // Ghi nhận chỉ số
      metrics.rss.byCategory.business = categorizedNews.business.length;
      metrics.rss.byCategory.tech = categorizedNews.tech.length;
      metrics.rss.byCategory.society = categorizedNews.society.length;
      metrics.rss.byCategory.world = categorizedNews.world.length;
      metrics.rss.totalScanned =
        categorizedNews.business.length +
        categorizedNews.tech.length +
        categorizedNews.society.length +
        categorizedNews.world.length;

      // Bước 2: AI chọn lọc (xử lý song song theo danh mục)
      this.logger.log('Bước 2: AI đang chọn lọc tin tức từ mỗi danh mục...');
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

      // DEV MODE: Tạo báo cáo chọn lọc AI
      if (this.devModeConfig.isDevMode) {
        const selectionResultMap = new Map<NewsCategory, SelectionResult>();
        categories.forEach((cat, idx) => {
          selectionResultMap.set(cat.key, selectionResults[idx]);
        });

        const reportHtml = this.selectionReportService.generateReport(
          categorizedNews,
          selectionResultMap,
        );
        const reportPath = this.selectionReportService.saveReport(reportHtml);
        this.logger.log(`📊 Báo cáo chọn lọc đã được tạo: ${reportPath}`);
      }

      // Trích xuất tin tức đã chọn
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

      this.logger.log(`Đã chọn ${selectedNews.length} tin tức`);

      // Thống kê bộ lọc tổng hợp
      const filterStats = this.aiService.aggregateFilterStats(selectionResults);
      this.logger.log(
        `Thống kê bộ lọc: đã quét=${filterStats.totalScanned}, đã chặn=${
          filterStats.blocked.crime +
          filterStats.blocked.gossip +
          filterStats.blocked.politicalStrife
        }`,
      );

      // Ghi nhận chỉ số
      metrics.aiSelection.totalFiltered = filterStats.totalScanned;
      metrics.aiSelection.toxicBlocked = filterStats.blocked;
      metrics.aiSelection.selected = selectedNews.length;

      // Bước 3: Cào nội dung bài viết
      this.logger.log('Bước 3: Đang cào nội dung bài viết...');
      const allScrapedNews: ScrapedNews[] =
        await this.scraperService.scrapeMultipleArticles(selectedNews);

      // Ghi nhận chỉ số
      metrics.scraping.attempted = selectedNews.length;
      metrics.scraping.succeeded = allScrapedNews.length;
      metrics.scraping.successRate =
        selectedNews.length > 0
          ? (allScrapedNews.length / selectedNews.length) * 100
          : 0;

      // Giới hạn tối đa 3 tin mỗi danh mục
      const scrapedNews: ScrapedNews[] = this.limitByCategory(
        allScrapedNews,
        3,
      );
      this.logger.log(
        `Đã giới hạn còn ${scrapedNews.length} tin (tối đa 3 tin mỗi danh mục)`,
      );

      // Bước 4: Tạo insight AI
      this.logger.log('Bước 4: Đang tạo insight...');
      const insights: InsightResult[] =
        await this.aiService.generateInsights(scrapedNews);

      // Ghi nhận chỉ số + loại bỏ tin thất bại
      metrics.insights.attempted = scrapedNews.length;

      // Tạo Map dựa trên index (để ánh xạ an toàn ngay cả khi AI thay đổi thứ tự hoặc bỏ qua)
      const insightMap = new Map<number, InsightResult>();
      for (const insight of insights) {
        if (insight.index !== undefined) {
          insightMap.set(insight.index, insight);
        }
      }

      const processedNews: ProcessedNews[] = [];
      for (let i = 0; i < scrapedNews.length; i++) {
        const news: ScrapedNews = scrapedNews[i];
        const insight: InsightResult | undefined = insightMap.get(i);

        // Có insight AI thì bao gồm
        if (insight && insight.detoxedTitle) {
          processedNews.push({
            original: news,
            isToxic: false,
            rewrittenTitle: insight.detoxedTitle,
            insight: insight.insight,
          });

          // Phân loại theo fallback
          if (insight.isFallback) {
            metrics.insights.fallback++;
          } else {
            metrics.insights.succeeded++;
          }
        } else {
          // Loại bỏ hoàn toàn nếu thất bại
          metrics.insights.failed++;
          this.logger.warn(
            `Tạo insight thất bại cho index ${i}: ${news.title} - loại khỏi bản tin`,
          );
        }
      }

      this.logger.log(
        `Số lượng tin cuối cùng sau khi lọc insight: ${processedNews.length}`,
      );

      // Bước 5: Phân tích xã luận tổng hợp
      this.logger.log('Bước 5: Đang xử lý xã luận...');
      let editorialSynthesis: EditorialSynthesis | undefined;

      // 5-1. Thu thập xã luận bảo thủ/tự do
      const [conservative, liberal]: [Editorial[], Editorial[]] =
        await Promise.all([
          this.rssService.fetchEditorials('conservative'),
          this.rssService.fetchEditorials('liberal'),
        ]);

      // 5-2. AI khớp chủ đề (tìm chủ đề giống nhau)
      const match = await this.aiService.matchEditorials(conservative, liberal);
      metrics.editorial.matchFound = !!match;

      if (match) {
        // 5-3. Cào nội dung xã luận đã khớp
        const [consContent, libContent] = await Promise.all([
          this.scraperService.scrapeArticle(
            conservative[match.conservativeIdx].link,
          ),
          this.scraperService.scrapeArticle(liberal[match.liberalIdx].link),
        ]);

        // 5-4. AI phân tích tổng hợp
        if (consContent && libContent) {
          editorialSynthesis =
            (await this.aiService.synthesizeEditorials(
              consContent,
              libContent,
              match.topic,
            )) ?? undefined;
          metrics.editorial.synthesisSuccess = !!editorialSynthesis;
          this.logger.log(`Hoàn thành tổng hợp xã luận: ${match.topic}`);
        } else {
          this.logger.warn('Không thể cào nội dung xã luận');
        }
      } else {
        this.logger.log('Không tìm thấy cặp xã luận tương đồng cho hôm nay');
      }

      // Bước 5.5: Kiểm tra cổng chất lượng
      this.logger.log('Bước 5.5: Đang kiểm tra cổng chất lượng...');

      metrics.final.newsCount = processedNews.length;

      // Tiêu chí 1: Số lượng tin tối thiểu (8 tin)
      const MIN_NEWS_COUNT = 8;
      if (processedNews.length < MIN_NEWS_COUNT) {
        metrics.final.qualityGatePassed = false;
        metrics.final.failureReason = `Số lượng tin không đủ: ${processedNews.length} < ${MIN_NEWS_COUNT}`;
        this.logMetrics(metrics);
        this.logger.error(
          `❌ Cổng chất lượng thất bại: ${metrics.final.failureReason}`,
        );
        this.logger.warn('Hủy tạo bản tin - không gửi email');
        return;
      }

      // Tiêu chí 2: Tỷ lệ cào thành công (60%)
      const MIN_SCRAPING_SUCCESS_RATE = 60;
      if (metrics.scraping.successRate < MIN_SCRAPING_SUCCESS_RATE) {
        metrics.final.qualityGatePassed = false;
        metrics.final.failureReason = `Tỷ lệ cào thành công thấp: ${metrics.scraping.successRate.toFixed(1)}% < ${MIN_SCRAPING_SUCCESS_RATE}%`;
        this.logMetrics(metrics);
        this.logger.error(
          `❌ Cổng chất lượng thất bại: ${metrics.final.failureReason}`,
        );
        this.logger.warn('Hủy tạo bản tin - không gửi email');
        return;
      }

      // Cổng chất lượng thông qua
      metrics.final.qualityGatePassed = true;
      this.logger.log('✅ Cổng chất lượng thông qua');

      // Step 6: Building newsletter data...
      this.logger.log('Step 6: Building newsletter data...');
      const vnDate = new Date()
        .toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\//g, '-');

      const newsletterData: NewsletterData = {
        date: vnDate,
        protectionLog: this.aiService.generateProtectionLog(filterStats),
        processedNews,
        editorialSynthesis,
      };

      // Bước 7: Render HTML và xem trước
      this.logger.log('Bước 7: Đang render bản tin...');
      const html = this.emailService.renderNewsletter(newsletterData);

      // Log xem trước (ngoại trừ việc gửi email)
      this.logger.log('--- Xem trước Bản tin ---');
      this.logger.log(`Ngày: ${newsletterData.date}`);
      this.logger.log(`Nhật ký bảo vệ: ${newsletterData.protectionLog}`);
      this.logger.log(`Số lượng tin: ${processedNews.length}`);
      for (let i = 0; i < processedNews.length; i++) {
        const news: ProcessedNews = processedNews[i];
        this.logger.log(
          `[${i + 1}] ${news.original.category}: ${news.rewrittenTitle}`,
        );
      }
      if (editorialSynthesis) {
        this.logger.log(`Chủ đề xã luận: ${editorialSynthesis.topic}`);
      }
      this.logger.log(`Độ dài HTML: ${html.length} ký tự`);

      // Bước 7 (tiếp): Gửi email
      this.logger.log('Bước 7 (tiếp): Đang gửi email bản tin...');

      // Kiểm tra chế độ dry-run (DEV_MODE hoặc NEWSLETTER_DRY_RUN)
      if (this.devModeConfig.skipEmail) {
        if (this.devModeConfig.isDevMode) {
          this.logger.warn('[DEV] Đã tắt gửi email trong chế độ dev');
        } else {
          this.logger.warn('🔴 CHẾ ĐỘ DRY-RUN: Đã tắt gửi email');
        }
        this.logger.log(
          'Để bật gửi email, hãy đặt NEWSLETTER_DRY_RUN=false và DEV_MODE=false',
        );
      } else {
        try {
          const recipients = await this.emailService.getRecipients();

          if (recipients.length === 0) {
            this.logger.warn(
              '⚠️ Không tìm thấy người đăng ký hoạt động. Bỏ qua gửi email.',
            );
          } else {
            this.logger.log(`📤 Đang gửi đến ${recipients.length} người nhận`);

            await this.emailService.sendNewsletter(recipients, html);

            this.logger.log(`✅ Hoàn tất gửi bản tin`);
            this.logger.log(
              `📊 Kích thước email: ${(html.length / 1024).toFixed(2)} KB`,
            );
          }
        } catch (error) {
          this.logger.error('❌ Gửi email bản tin thất bại', error);
          this.logger.warn('Đã tạo bản tin nhưng gửi email thất bại');
          this.logger.warn(
            'Hãy kiểm tra thông tin đăng nhập Resend và địa chỉ người nhận',
          );
          //Không throw lại lỗi - lỗi email không nên làm hỏng toàn bộ pipeline
        }
      }
      //Bước 8: Trích xuất từ khóa và lưu trữ bản tin
      this.logger.log('Bước 8: Đang trích xuất từ khóa và lưu trữ bản tin...');
      try {
        // Lấy từ khóa hiện có (để duy trì tính nhất quán)
        const existingKeywords =
          await this.supabaseService.getAllExistingKeywords();

        // Trích xuất từ khóa (để theo dõi vấn đề - tham chiếu từ khóa hiện có, ánh xạ theo bài viết)
        const keywordResult = await this.aiService.extractKeywords(
          processedNews.map((news) => ({
            title: news.rewrittenTitle ?? news.original.title,
            insight: news.insight,
          })),
          existingKeywords,
        );
        this.logger.log(
          `Đã trích xuất ${keywordResult.all.length} từ khóa để theo dõi vấn đề`,
        );

        await this.saveToArchive(
          newsletterData,
          html,
          filterStats,
          keywordResult,
        );
        this.logger.log('✅ Đã lưu trữ bản tin thành công');
      } catch (archiveError) {
        this.logger.error(
          `❌ Lưu trữ bản tin thất bại (không nghiêm trọng): ${archiveError}`,
        );
      }

      // Bước 9: In chỉ số cuối cùng
      this.logMetrics(metrics);

      this.logger.log('=== Hoàn tất tạo bản tin Morning News ===');
    } catch (error) {
      this.logger.error('Tạo bản tin thất bại', error);
      this.logMetrics(metrics);
      throw error;
    }
  }

  /**
   * Giới hạn tối đa N tin mỗi danh mục
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
   * Ghi chỉ số vào log
   */
  private logMetrics(metrics: NewsletterMetrics): void {
    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📊 Chỉ số Tạo Bản tin');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Thu thập RSS
    this.logger.log('');
    this.logger.log('📰 Thu thập RSS:');
    this.logger.log(`   Tổng đã quét: ${metrics.rss.totalScanned}`);
    this.logger.log(`   Kinh doanh: ${metrics.rss.byCategory.business || 0}`);
    this.logger.log(`   Công nghệ: ${metrics.rss.byCategory.tech || 0}`);
    this.logger.log(`   Xã hội: ${metrics.rss.byCategory.society || 0}`);
    this.logger.log(`   Thế giới: ${metrics.rss.byCategory.world || 0}`);

    // AI chọn lọc (Bộ lọc độc hại)
    this.logger.log('');
    this.logger.log('🤖 AI Chọn lọc (Bộ lọc độc hại):');
    this.logger.log(`   Tổng đã lọc: ${metrics.aiSelection.totalFiltered}`);
    this.logger.log(
      `   Đã chặn tin độc hại: ${
        metrics.aiSelection.toxicBlocked.crime +
        metrics.aiSelection.toxicBlocked.gossip +
        metrics.aiSelection.toxicBlocked.politicalStrife
      } (Tội phạm: ${metrics.aiSelection.toxicBlocked.crime}, Chuyện phiếm: ${
        metrics.aiSelection.toxicBlocked.gossip
      }, Chính trị: ${metrics.aiSelection.toxicBlocked.politicalStrife})`,
    );
    this.logger.log(`   Đã chọn: ${metrics.aiSelection.selected}`);

    // Cào dữ liệu
    this.logger.log('');
    this.logger.log('📄 Cào dữ liệu:');
    this.logger.log(`   Đã thử: ${metrics.scraping.attempted}`);
    this.logger.log(`   Thành công: ${metrics.scraping.succeeded}`);
    this.logger.log(
      `   Tỷ lệ thành công: ${metrics.scraping.successRate.toFixed(1)}%`,
    );

    // AI Insight
    this.logger.log('');
    this.logger.log('💡 AI Insight:');
    this.logger.log(`   Đã thử: ${metrics.insights.attempted}`);
    this.logger.log(`   Thành công: ${metrics.insights.succeeded}`);
    this.logger.log(`   Fallback: ${metrics.insights.fallback}`);
    this.logger.log(`   Thất bại (Loại bỏ): ${metrics.insights.failed}`);

    // Xã luận
    this.logger.log('');
    this.logger.log('📝 Phân tích Xã luận:');
    this.logger.log(
      `   Tìm thấy cặp bài: ${metrics.editorial.matchFound ? 'Có' : 'Không'}`,
    );
    if (metrics.editorial.matchFound) {
      this.logger.log(
        `   Tổng hợp thành công: ${metrics.editorial.synthesisSuccess ? 'Có' : 'Không'}`,
      );
    }

    // Kết quả cuối cùng
    this.logger.log('');
    this.logger.log('✨ Kết quả cuối cùng:');
    this.logger.log(`   Số lượng tin: ${metrics.final.newsCount}`);
    this.logger.log(
      `   Cổng chất lượng: ${metrics.final.qualityGatePassed ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}`,
    );
    if (metrics.final.failureReason) {
      this.logger.log(`   Lý do thất bại: ${metrics.final.failureReason}`);
    }

    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
  }

  /**
   * Lưu bản tin vào kho lưu trữ
   */
  private async saveToArchive(
    data: NewsletterData,
    html: string,
    filterStats: FilterStats,
    keywordResult: { perArticle: string[][]; all: string[] } = {
      perArticle: [],
      all: [],
    },
  ): Promise<void> {
    const contentData = this.buildContentData(
      data,
      filterStats,
      keywordResult.perArticle,
    );
    const title = this.emailService.getEmailSubject();

    // Xóa liên kết hủy đăng ký (xử lý ổn định bằng cheerio để phân tích HTML)
    const $ = cheerio.load(html);

    // Tìm liên kết unsubscribe và chuyển đổi thành văn bản
    $('a').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href') || '';
      const text = $el.text();

      // Trường hợp là liên kết hủy đăng ký hoặc xem trên web
      if (
        href.includes('unsubscribe') ||
        href.includes('{{UNSUBSCRIBE_URL}}') ||
        text.includes('Hủy đăng ký') || // Vietnamese
        text.includes('Unsubscribe') ||
        href.includes('archive') ||
        href.includes('{{ARCHIVE_URL}}') ||
        text.includes('Xem trên web') || // Vietnamese
        text.includes('Xem trên trình duyệt') // Vietnamese alternate
      ) {
        // Xóa hoàn toàn phần tử liên kết
        $el.remove();
      }
    });

    const archivedHtml = $.html();

    await this.supabaseService.saveNewsletter({
      sendDate: new Date(),
      title,
      contentHtml: archivedHtml,
      contentData,
      allKeywords: keywordResult.all,
    });
  }

  /**
   * Chuyển đổi NewsletterData sang định dạng ContentData
   */
  private buildContentData(
    data: NewsletterData,
    filterStats: FilterStats,
    perArticleKeywords: string[][] = [],
  ): ContentData {
    const contentData: ContentData = {
      filter_stats: {
        total_scanned: filterStats.totalScanned,
        blocked_counts: {
          crime: filterStats.blocked.crime,
          gossip: filterStats.blocked.gossip,
          political_noise: filterStats.blocked.politicalStrife,
        },
      },
      news_items: data.processedNews.map((news, idx) => ({
        category: news.original.category,
        original_title: news.original.title,
        refined_title: news.rewrittenTitle ?? news.original.title,
        link: news.original.link,
        keywords: perArticleKeywords[idx] ?? [],
        insight: {
          fact: news.insight?.fact ?? '',
          context: news.insight?.context ?? '',
          implication: news.insight?.implication ?? '',
        },
      })),
    };

    if (data.editorialSynthesis) {
      contentData.editorial_analysis = {
        topic: data.editorialSynthesis.topic,
        key_issue: data.editorialSynthesis.conflict,
        perspectives: {
          conservative: data.editorialSynthesis.argumentA,
          liberal: data.editorialSynthesis.argumentB,
        },
        synthesis: data.editorialSynthesis.synthesis,
      };
    }

    return contentData;
  }
}
