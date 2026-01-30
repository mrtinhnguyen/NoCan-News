import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ContentData } from '../../common/interfaces';
import { Database, Json, Tables } from '../../common/types/supabase';

export type Subscriber = Tables<'subscribers'>;
export type Newsletter = Tables<'newsletters'>;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient<Database>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SECRET_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SECRET_KEY must be configured',
      );
    }

    this.client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase client initialized');
  }

  async onModuleInit(): Promise<void> {
    try {
      const { error } = await this.client
        .from('subscribers')
        .select('id')
        .limit(1);

      if (error) {
        this.logger.error(`Failed to connect to Supabase: ${error.message}`);
        throw error;
      }

      this.logger.log('Supabase connection verified successfully');
    } catch (error) {
      this.logger.error('Supabase connection verification failed', error);
      throw error;
    }
  }

  /**
   * Get the Supabase client for advanced queries
   */
  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  /**
   * Get all active subscriber emails
   */
  async getActiveSubscribers(): Promise<string[]> {
    const { data, error } = await this.client
      .from('subscribers')
      .select('email')
      .eq('is_active', true);

    if (error) {
      this.logger.error(`Failed to fetch subscribers: ${error.message}`);
      throw error;
    }

    const emails = data?.map((row) => row.email) ?? [];
    this.logger.log(`Fetched ${emails.length} active subscriber(s)`);
    return emails;
  }

  /**
   * Get all active subscribers with id and email
   */
  async getActiveSubscribersWithId(): Promise<{ id: string; email: string }[]> {
    const { data, error } = await this.client
      .from('subscribers')
      .select('id, email')
      .eq('is_active', true);

    if (error) {
      this.logger.error(`Failed to fetch subscribers: ${error.message}`);
      throw error;
    }

    const subscribers = (data ?? []) as { id: string; email: string }[];
    this.logger.log(`Fetched ${subscribers.length} active subscriber(s)`);
    return subscribers;
  }

  /**
   * Get all subscribers (including inactive)
   */
  async getAllSubscribers(): Promise<Subscriber[]> {
    const { data, error } = await this.client
      .from('subscribers')
      .select('id, email, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch all subscribers: ${error.message}`);
      throw error;
    }

    return (data ?? []) as Subscriber[];
  }

  /**
   * Add a new subscriber
   */
  async addSubscriber(email: string): Promise<Subscriber> {
    const { data, error } = await this.client
      .from('subscribers')
      .insert({ email })
      .select('id, email, is_active, created_at')
      .single();

    if (error) {
      this.logger.error(`Failed to add subscriber: ${error.message}`);
      throw error;
    }

    this.logger.log(`Added new subscriber: ${email}`);
    return data as Subscriber;
  }

  /**
   * Deactivate a subscriber (soft delete / unsubscribe)
   */
  async deactivateSubscriber(email: string): Promise<void> {
    const { error } = await this.client
      .from('subscribers')
      .update({ is_active: false })
      .eq('email', email);

    if (error) {
      this.logger.error(`Failed to deactivate subscriber: ${error.message}`);
      throw error;
    }

    this.logger.log(`Deactivated subscriber: ${email}`);
  }

  /**
   * Reactivate a subscriber
   */
  async reactivateSubscriber(email: string): Promise<void> {
    const { error } = await this.client
      .from('subscribers')
      .update({ is_active: true })
      .eq('email', email);

    if (error) {
      this.logger.error(`Failed to reactivate subscriber: ${error.message}`);
      throw error;
    }

    this.logger.log(`Reactivated subscriber: ${email}`);
  }

  /**
   * Find subscriber by email
   */
  async findByEmail(email: string): Promise<Subscriber | null> {
    const { data, error } = await this.client
      .from('subscribers')
      .select('id, email, is_active, created_at')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      this.logger.error(`Failed to find subscriber: ${error.message}`);
      throw error;
    }

    return data as Subscriber;
  }

  /**
   * Get subscriber statistics
   */
  async getStats(): Promise<{
    active: number;
    inactive: number;
    total: number;
  }> {
    const { data, error } = await this.client
      .from('subscribers')
      .select('is_active');

    if (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw error;
    }

    const subscribers = (data ?? []) as { is_active: boolean }[];
    const active = subscribers.filter((s) => s.is_active).length;
    const inactive = subscribers.filter((s) => !s.is_active).length;

    return {
      active,
      inactive,
      total: subscribers.length,
    };
  }

  /**
   * Save newsletter to archive
   */
  async saveNewsletter(data: {
    sendDate: Date;
    title: string;
    contentHtml: string;
    contentData: ContentData;
    allKeywords?: string[];
  }): Promise<void> {
    const sendDateStr = data.sendDate
      .toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');

    // Serialize JSON explicitly and parse back to ensure only pure object is saved
    const jsonStr = JSON.stringify(data.contentData);
    const cleanedData = JSON.parse(jsonStr);

    this.logger.debug(
      `Saving newsletter content_data (${jsonStr.length} chars), ends with: "${jsonStr.slice(-50)}"`,
    );

    const { error } = await this.client.from('newsletters').insert({
      send_date: sendDateStr,
      title: data.title,
      content_html: data.contentHtml,
      content_data: cleanedData,
      all_keywords: data.allKeywords ?? [],
    });

    if (error) {
      this.logger.error(`Failed to save newsletter: ${error.message}`);
      throw error;
    }

    this.logger.log(
      `Newsletter archived for ${sendDateStr} with ${data.allKeywords?.length ?? 0} keywords`,
    );
  }

  /**
   * Get all distinct keywords from existing newsletters
   * Used to maintain keyword consistency across newsletters
   */
  async getAllExistingKeywords(): Promise<string[]> {
    const { data, error } = await this.client
      .from('newsletters')
      .select('all_keywords')
      .not('all_keywords', 'eq', '{}');

    if (error) {
      this.logger.error(`Failed to fetch existing keywords: ${error.message}`);
      return [];
    }

    // Flatten and deduplicate all keywords
    const allKeywords = new Set<string>();
    for (const row of data ?? []) {
      const keywords = row.all_keywords as string[] | null;
      if (keywords) {
        for (const keyword of keywords) {
          allKeywords.add(keyword);
        }
      }
    }

    const result = [...allKeywords];
    this.logger.log(`Found ${result.length} distinct existing keywords`);
    return result;
  }

  // ==========================================
  // Issue Tracking Methods
  // ==========================================

  /**
   * Get all active issue tracks
   */
  async getActiveIssueTracks(): Promise<Tables<'issue_tracks'>[]> {
    const { data, error } = await this.client
      .from('issue_tracks')
      .select('*')
      .eq('is_active', true)
      .order('last_updated_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch active issue tracks: ${error.message}`,
      );
      throw error;
    }

    return (data ?? []) as Tables<'issue_tracks'>[];
  }

  /**
   * Get issue track by keyword
   */
  async getIssueTrackByKeyword(
    keyword: string,
  ): Promise<Tables<'issue_tracks'> | null> {
    const { data, error } = await this.client
      .from('issue_tracks')
      .select('*')
      .eq('keyword', keyword)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to fetch issue track: ${error.message}`);
      throw error;
    }

    return data as Tables<'issue_tracks'>;
  }

  /**
   * Update issue track report
   */
  async updateIssueTrackReport(
    id: string,
    reportHtml: string,
    reportData: Json,
  ): Promise<void> {
    const { error } = await this.client
      .from('issue_tracks')
      .update({
        last_report_html: reportHtml,
        last_report_data: reportData,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to update issue track report: ${error.message}`,
      );
      throw error;
    }

    this.logger.log(`Issue track ${id} report updated`);
  }

  /**
   * Find newsletters containing specific keywords
   */
  async findNewslettersByKeywords(
    keywords: string[],
    days: number = 30,
  ): Promise<Newsletter[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from('newsletters')
      .select('*')
      .gte('send_date', startDateStr)
      .overlaps('all_keywords', keywords)
      .order('send_date', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to find newsletters by keywords: ${error.message}`,
      );
      throw error;
    }

    return (data ?? []) as Newsletter[];
  }

  // ==========================================
  // Payment Intent Log Methods
  // ==========================================

  /**
   * Log payment intent (fake door testing)
   */
  async logPaymentIntent(data: {
    issueTrackId?: string;
    targetIssue: string;
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  }): Promise<void> {
    const { error } = await this.client.from('payment_intent_logs').insert({
      issue_track_id: data.issueTrackId,
      target_issue: data.targetIssue,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
      referrer: data.referrer,
    });

    if (error) {
      this.logger.error(`Failed to log payment intent: ${error.message}`);
      throw error;
    }

    this.logger.log(`Payment intent logged for issue: ${data.targetIssue}`);
  }

  /**
   * Get payment intent statistics for an issue
   */
  async getPaymentIntentStats(
    targetIssue: string,
  ): Promise<{ totalClicks: number; uniqueIps: number }> {
    const { data, error } = await this.client
      .from('payment_intent_logs')
      .select('ip_address')
      .eq('target_issue', targetIssue);

    if (error) {
      this.logger.error(`Failed to get payment intent stats: ${error.message}`);
      throw error;
    }

    const logs = data ?? [];
    const uniqueIps = new Set(
      logs.map((log) => log.ip_address).filter(Boolean),
    );

    return {
      totalClicks: logs.length,
      uniqueIps: uniqueIps.size,
    };
  }
}
