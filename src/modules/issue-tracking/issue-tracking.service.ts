import { Injectable, Logger } from '@nestjs/common';
import {
  IssueReportData,
  IssueTimelineEntry,
  IssueTrack,
} from '../../common/interfaces';
import { Json, Tables } from '../../common/types/supabase';
import { AiService } from '../ai/ai.service';
import { Newsletter, SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class IssueTrackingService {
  private readonly logger = new Logger(IssueTrackingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Cập nhật báo cáo cho tất cả các vấn đề đang theo dõi
   * Nên chạy SAU khi bản tin được gửi (ví dụ: 07:30 giờ Việt Nam)
   */
  async updateAllReports(): Promise<void> {
    this.logger.log('Bắt đầu cập nhật báo cáo vấn đề...');

    const activeIssues = await this.supabaseService.getActiveIssueTracks();
    this.logger.log(`Tìm thấy ${activeIssues.length} vấn đề đang theo dõi`);

    for (const issue of activeIssues) {
      try {
        await this.updateIssueReport(issue);
      } catch (error) {
        this.logger.error(
          `Không thể cập nhật báo cáo cho "${issue.keyword}": ${error}`,
        );
      }
    }

    this.logger.log('Hoàn thành cập nhật báo cáo vấn đề');
  }

  /**
   * Tạo/cập nhật báo cáo cho một vấn đề được theo dõi
   */
  async updateIssueReport(issue: Tables<'issue_tracks'>): Promise<void> {
    this.logger.log(`Đang cập nhật báo cáo cho vấn đề: ${issue.keyword}`);

    // 1. Tìm các bản tin liên quan (30 ngày qua)
    const relatedNewsletters =
      await this.supabaseService.findNewslettersByKeywords([issue.keyword], 30);

    if (relatedNewsletters.length === 0) {
      this.logger.log(
        `Không tìm thấy bản tin liên quan cho "${issue.keyword}"`,
      );
      return;
    }

    this.logger.log(
      `Tìm thấy ${relatedNewsletters.length} bản tin liên quan cho "${issue.keyword}"`,
    );

    // 2. Xây dựng dòng thời gian từ các bản tin
    const timeline = this.buildTimeline(relatedNewsletters, issue.keyword);

    // 3. Tạo tóm tắt bằng AI (đơn giản hóa cho hiện tại)
    const summary = this.generateSummary(issue.keyword, timeline);

    // 4. Xây dựng dữ liệu báo cáo
    const reportData: IssueReportData = {
      keyword: issue.keyword,
      report_date: new Date().toISOString(),
      summary,
      timeline,
      key_insights: this.extractKeyInsights(timeline),
      related_news_count: timeline.reduce(
        (acc, t) => acc + t.news_items.length,
        0,
      ),
      date_range: {
        start: timeline[timeline.length - 1]?.date ?? '',
        end: timeline[0]?.date ?? '',
      },
    };

    // 5. Render báo cáo HTML
    const reportHtml = this.renderReport(issue, reportData);

    // 6. Lưu vào cơ sở dữ liệu
    await this.supabaseService.updateIssueTrackReport(
      issue.id,
      reportHtml,
      reportData as unknown as Json,
    );

    this.logger.log(`Đã cập nhật báo cáo cho "${issue.keyword}"`);
  }

  /**
   * Xây dựng dòng thời gian từ các bản tin
   */
  private buildTimeline(
    newsletters: Newsletter[],
    keyword: string,
  ): IssueTimelineEntry[] {
    const timeline: IssueTimelineEntry[] = [];

    for (const newsletter of newsletters) {
      const contentData = newsletter.content_data as {
        news_items?: Array<{
          category: string;
          original_title: string;
          refined_title: string;
          link: string;
          keywords?: string[];
          insight: { fact: string; context: string; implication: string };
        }>;
      };

      if (!contentData?.news_items) continue;

      // Lọc các mục tin tức khớp với từ khóa
      const matchingItems = contentData.news_items.filter((item) => {
        // Nếu có từ khóa theo bài viết thì dùng nó để khớp (chính xác)
        if (item.keywords?.length) {
          return item.keywords.includes(keyword);
        }
        // fallback: Khớp văn bản (tương thích dữ liệu cũ)
        return (
          item.original_title.includes(keyword) ||
          item.refined_title.includes(keyword) ||
          item.insight.fact.includes(keyword) ||
          item.insight.context.includes(keyword)
        );
      });

      if (matchingItems.length > 0) {
        timeline.push({
          date: newsletter.send_date,
          news_items: matchingItems.map((item) => ({
            title: item.original_title,
            refined_title: item.refined_title,
            link: item.link,
            category: item.category,
            insight_summary: item.insight.fact,
          })),
        });
      }
    }

    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    return timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  /**
   * Tạo tóm tắt bằng AI (đơn giản hóa)
   */
  private generateSummary(
    keyword: string,
    timeline: IssueTimelineEntry[],
  ): string {
    if (timeline.length === 0) {
      return `Không có tin tức gần đây liên quan đến "${keyword}".`;
    }

    const totalNews = timeline.reduce((acc, t) => acc + t.news_items.length, 0);
    const dateRange = `${timeline[timeline.length - 1]?.date} ~ ${timeline[0]?.date}`;

    return `Vấn đề "${keyword}" đã được đề cập trong tổng số ${totalNews} tin tức trong ${timeline.length} ngày qua. (${dateRange})`;
  }

  /**
   * Trích xuất các insight chính từ dòng thời gian
   */
  private extractKeyInsights(timeline: IssueTimelineEntry[]): string[] {
    const insights: string[] = [];

    for (const entry of timeline.slice(0, 5)) {
      for (const item of entry.news_items.slice(0, 2)) {
        if (item.insight_summary) {
          insights.push(item.insight_summary);
        }
      }
    }

    return insights.slice(0, 5);
  }

  /**
   * Render báo cáo HTML cho một vấn đề
   */
  private renderReport(
    issue: Tables<'issue_tracks'>,
    data: IssueReportData,
  ): string {
    const timelineHtml = data.timeline
      .map(
        (entry) => `
      <div class="timeline-entry">
        <h4>${entry.date}</h4>
        <ul>
          ${entry.news_items
            .map(
              (item) => `
            <li>
              <strong>[${item.category}]</strong>
              <a href="${item.link}" target="_blank">${item.refined_title}</a>
              <p>${item.insight_summary}</p>
            </li>
          `,
            )
            .join('')}
        </ul>
      </div>
    `,
      )
      .join('');

    const insightsHtml = data.key_insights
      .map((insight) => `<li>${insight}</li>`)
      .join('');

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${issue.display_title} - Báo cáo Vấn đề NoCan News</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #000; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .timeline-entry { margin-bottom: 20px; padding: 15px; border-left: 3px solid #000; }
    .timeline-entry h4 { margin: 0 0 10px 0; }
    .timeline-entry ul { margin: 0; padding-left: 20px; }
    .timeline-entry li { margin-bottom: 10px; }
    .insights { background: #fffde7; padding: 15px; border-radius: 5px; }
    .insights ul { margin: 0; padding-left: 20px; }
  </style>
</head>
<body>
  <h1>${issue.display_title}</h1>
  <div class="meta">
    <p>Từ khóa: <strong>${issue.keyword}</strong></p>
    <p>Cập nhật: ${data.report_date.split('T')[0]}</p>
    <p>Tin tức liên quan: ${data.related_news_count} bài (${data.date_range.start} ~ ${data.date_range.end})</p>
  </div>

  <div class="summary">
    <h3>Tóm tắt</h3>
    <p>${data.summary}</p>
  </div>

  ${
    data.key_insights.length > 0
      ? `
  <div class="insights">
    <h3>Insight Chính</h3>
    <ul>${insightsHtml}</ul>
  </div>
  `
      : ''
  }

  <h2>Dòng thời gian</h2>
  ${timelineHtml || '<p>Không có tin tức liên quan.</p>'}
</body>
</html>
    `.trim();
  }

  /**
   * Lấy tất cả các vấn đề đang hoạt động để hiển thị
   */
  async getActiveIssues(): Promise<IssueTrack[]> {
    const issues = await this.supabaseService.getActiveIssueTracks();
    return issues.map((issue) => ({
      id: issue.id,
      keyword: issue.keyword,
      display_title: issue.display_title,
      is_active: issue.is_active,
      last_report_html: issue.last_report_html ?? undefined,
      last_report_data: issue.last_report_data as unknown as
        | IssueReportData
        | undefined,
      last_updated_at: issue.last_updated_at,
      created_at: issue.created_at,
    }));
  }

  /**
   * Ghi log ý định thanh toán (để kiểm thử fake door)
   */
  async logPaymentIntent(
    targetIssue: string,
    metadata?: {
      issueTrackId?: string;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    },
  ): Promise<void> {
    await this.supabaseService.logPaymentIntent({
      issueTrackId: metadata?.issueTrackId,
      targetIssue,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      referrer: metadata?.referrer,
    });
  }
}
