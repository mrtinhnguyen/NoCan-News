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
   * Update reports for all active tracked issues
   * Should run AFTER newsletter is sent (e.g., 07:30 KST)
   */
  async updateAllReports(): Promise<void> {
    this.logger.log('Starting issue report updates...');

    const activeIssues = await this.supabaseService.getActiveIssueTracks();
    this.logger.log(`Found ${activeIssues.length} active issue tracks`);

    for (const issue of activeIssues) {
      try {
        await this.updateIssueReport(issue);
      } catch (error) {
        this.logger.error(
          `Failed to update report for "${issue.keyword}": ${error}`,
        );
      }
    }

    this.logger.log('Issue report updates completed');
  }

  /**
   * Generate/update report for a single tracked issue
   */
  async updateIssueReport(issue: Tables<'issue_tracks'>): Promise<void> {
    this.logger.log(`Updating report for issue: ${issue.keyword}`);

    // 1. Find related newsletters (last 30 days)
    const relatedNewsletters =
      await this.supabaseService.findNewslettersByKeywords([issue.keyword], 30);

    if (relatedNewsletters.length === 0) {
      this.logger.log(`No related newsletters found for "${issue.keyword}"`);
      return;
    }

    this.logger.log(
      `Found ${relatedNewsletters.length} related newsletters for "${issue.keyword}"`,
    );

    // 2. Build timeline from newsletters
    const timeline = this.buildTimeline(relatedNewsletters, issue.keyword);

    // 3. Generate AI summary (simplified for now)
    const summary = this.generateSummary(issue.keyword, timeline);

    // 4. Build report data
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

    // 5. Render HTML report
    const reportHtml = this.renderReport(issue, reportData);

    // 6. Save to database
    await this.supabaseService.updateIssueTrackReport(
      issue.id,
      reportHtml,
      reportData as unknown as Json,
    );

    this.logger.log(`Report updated for "${issue.keyword}"`);
  }

  /**
   * Build timeline from newsletters
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

      // Filter news items that match the keyword
      const matchingItems = contentData.news_items.filter((item) => {
        // 기사별 키워드가 있으면 그걸로 매칭 (정확)
        if (item.keywords?.length) {
          return item.keywords.includes(keyword);
        }
        // fallback: 텍스트 매칭 (기존 데이터 호환)
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

    // Sort by date descending (most recent first)
    return timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  /**
   * Generate summary using AI (simplified)
   */
  private generateSummary(
    keyword: string,
    timeline: IssueTimelineEntry[],
  ): string {
    if (timeline.length === 0) {
      return `"${keyword}" 관련 최근 뉴스가 없습니다.`;
    }

    const totalNews = timeline.reduce((acc, t) => acc + t.news_items.length, 0);
    const dateRange = `${timeline[timeline.length - 1]?.date} ~ ${timeline[0]?.date}`;

    return `"${keyword}" 이슈는 최근 ${timeline.length}일 동안 총 ${totalNews}건의 뉴스에서 다뤄졌습니다. (${dateRange})`;
  }

  /**
   * Extract key insights from timeline
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
   * Render HTML report for an issue
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
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${issue.display_title} - NoCan News Issue Report</title>
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
    <p>키워드: <strong>${issue.keyword}</strong></p>
    <p>업데이트: ${data.report_date.split('T')[0]}</p>
    <p>관련 뉴스: ${data.related_news_count}건 (${data.date_range.start} ~ ${data.date_range.end})</p>
  </div>

  <div class="summary">
    <h3>요약</h3>
    <p>${data.summary}</p>
  </div>

  ${
    data.key_insights.length > 0
      ? `
  <div class="insights">
    <h3>핵심 인사이트</h3>
    <ul>${insightsHtml}</ul>
  </div>
  `
      : ''
  }

  <h2>타임라인</h2>
  ${timelineHtml || '<p>관련 뉴스가 없습니다.</p>'}
</body>
</html>
    `.trim();
  }

  /**
   * Get all active issues for display
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
   * Log payment intent (for fake door testing)
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
