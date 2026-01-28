/**
 * Issue Tracking Interfaces
 * Pre-baked AI reports for deep dive feature and fake door testing
 */

/**
 * Tracked issue configuration stored in issue_tracks table
 */
export interface IssueTrack {
  id: string;
  keyword: string;
  display_title: string;
  is_active: boolean;
  last_report_html?: string;
  last_report_data?: IssueReportData;
  last_updated_at: string;
  created_at: string;
}

/**
 * Structured report data for a tracked issue (stored as JSONB)
 */
export interface IssueReportData {
  keyword: string;
  report_date: string;
  summary: string;
  timeline: IssueTimelineEntry[];
  key_insights: string[];
  related_news_count: number;
  date_range: {
    start: string;
    end: string;
  };
}

/**
 * Timeline entry showing news over time
 */
export interface IssueTimelineEntry {
  date: string;
  news_items: {
    title: string;
    refined_title: string;
    link: string;
    category: string;
    insight_summary: string;
  }[];
}

/**
 * Payment intent log for fake door testing
 */
export interface PaymentIntentLog {
  id: string;
  issue_track_id?: string;
  target_issue: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  clicked_at: string;
}

/**
 * Input data for logging payment intent
 */
export interface PaymentIntentInput {
  issueTrackId?: string;
  targetIssue: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}
