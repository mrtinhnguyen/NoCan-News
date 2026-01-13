import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ContentData } from '../../common/interfaces';
import { Database, Tables } from '../../common/types/supabase';

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
  }): Promise<void> {
    const sendDateStr = data.sendDate
      .toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\. /g, '-')
      .replace('.', '');

    // 명시적으로 JSON 직렬화 후 파싱하여 순수 객체만 저장
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
    });

    if (error) {
      this.logger.error(`Failed to save newsletter: ${error.message}`);
      throw error;
    }

    this.logger.log(`Newsletter archived for ${sendDateStr}`);
  }
}
