import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { NewsletterData, ProcessedNews } from '../../common/interfaces';
import { SupabaseService } from '../supabase/supabase.service';

export interface Recipient {
  id: string;
  email: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.initializeResend();
  }

  private initializeResend(): void {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend client initialized');
    } else {
      this.logger.warn(
        'RESEND_API_KEY not configured. Email sending disabled.',
      );
    }
  }

  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      business: 'Kinh tế',
      tech: 'Công nghệ',
      society: 'Xã hội',
      world: 'Thế giới',
    };
    return names[category] || category;
  }

  /**
   * Tạo tiêu đề email
   */
  getEmailSubject(): string {
    const today = new Date()
      .toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');

    return `🔇 NoCan News - ${today} | Tin tức hôm nay`;
  }

  /**
   * Render HTML bản tin
   * Footer bao gồm placeholder {{UNSUBSCRIBE_URL}}
   */
  renderNewsletter(data: NewsletterData): string {
    this.logger.log('Rendering newsletter HTML...');
    const { date, protectionLog, processedNews, editorialSynthesis } = data;

    const newsByCategory: Record<string, ProcessedNews[]> = {};
    for (const news of processedNews) {
      const cat = news.original.category;
      if (!newsByCategory[cat]) {
        newsByCategory[cat] = [];
      }
      newsByCategory[cat].push(news);
    }

    let newsHtml = '';
    const categoryOrder = ['business', 'tech', 'society', 'world'];

    for (const category of categoryOrder) {
      const newsItems = newsByCategory[category];
      if (!newsItems || newsItems.length === 0) continue;

      newsHtml += `
        <div style="margin-bottom: 32px;">
          <h2 style="color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #4a4e69; padding-bottom: 8px; margin-bottom: 16px;">
            📌 ${this.getCategoryName(category)}
          </h2>
          ${newsItems.map((news) => this.renderNewsItem(news)).join('')}
        </div>
      `;
    }

    let editorialHtml = '';
    if (editorialSynthesis) {
      editorialHtml = `
        <div style="margin-top: 32px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px;">
          <h2 style="color: #1a1a2e; font-size: 20px; margin-bottom: 16px;">
            ⚖️ Phân tích xã luận hôm nay
          </h2>
          <p style="font-size: 16px; font-weight: 600; color: #343a40; margin-bottom: 12px;">
            ${editorialSynthesis.topic}
          </p>
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #495057; margin: 0;">
              <strong>🔴 Vấn đề cốt lõi:</strong> ${editorialSynthesis.conflict}
            </p>
          </div>
          <div style="background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #c92a2a; font-weight: 600; margin: 0 0 8px 0;">Quan điểm A</p>
            <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentA}</p>
          </div>
          <div style="background: #e7f5ff; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #1971c2; font-weight: 600; margin: 0 0 8px 0;">Quan điểm B</p>
            <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentB}</p>
          </div>
          <div style="background: #f1f3f5; padding: 12px; border-radius: 8px;">
            <p style="font-size: 13px; color: #495057; margin: 0;">
              <strong>💡 Ý nghĩa cấu trúc:</strong> ${editorialSynthesis.synthesis}
            </p>
          </div>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NoCan News - ${date}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 16px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 8px 0; letter-spacing: -0.5px;">
        🔇 NoCan News
      </h1>
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">
        Tắt tiếng ồn, Bật bối cảnh (Noise Off, Context On)
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
        ${date}
      </p>
      <a href="{{ARCHIVE_URL}}" style="display: inline-block; margin-top: 12px; padding: 6px 16px; background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 12px; text-decoration: none; border-radius: 20px; border: 1px solid rgba(255,255,255,0.4);">
        Xem trên web
      </a>
    </div>

    <!-- Protection Log -->
    <div style="background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); padding: 16px; border-bottom: 1px solid #e5e7eb;">
      <p style="color: #10b981; font-size: 14px; margin: 0;">
        🛡️ ${protectionLog}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 16px;">
      ${newsHtml}
      ${editorialHtml}
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 24px 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
        NoCan News là bản tin được biên tập bởi AI.
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">
        Powered by Gemini AI • Noise Off, Context On
      </p>

      <!-- Unsubscribe Link Placeholder -->
      <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af; font-size: 11px; text-decoration: underline;">
        Hủy đăng ký (Unsubscribe)
      </a>
    </div>

  </div>
</body>
</html>
    `.trim();
  }

  private renderNewsItem(news: ProcessedNews): string {
    const { original, rewrittenTitle, insight } = news;

    return `
      <div style="margin-bottom: 24px; padding: 16px; background: #fafafa; border-radius: 8px; border-left: 4px solid #4a4e69;">
        <p style="font-size: 12px; color: #9ca3af; text-decoration: line-through; margin: 0 0 8px 0;">
          ${original.title}
        </p>
        <h3 style="font-size: 16px; color: #1a1a2e; font-weight: 600; margin: 0 0 12px 0; line-height: 1.4;">
          ${rewrittenTitle || original.title}
        </h3>
        ${
          insight
            ? `
        <div style="background: white; padding: 12px; border-radius: 6px;">
          <p style="font-size: 13px; color: #374151; margin: 0 0 8px 0; line-height: 1.5;">
            <span style="color: #3b82f6; font-weight: 600;">📍 Sự kiện:</span> ${insight.fact}
          </p>
          <p style="font-size: 13px; color: #374151; margin: 0 0 8px 0; line-height: 1.5;">
            <span style="color: #f59e0b; font-weight: 600;">📍 Bối cảnh:</span> ${insight.context}
          </p>
          <p style="font-size: 13px; color: #374151; margin: 0; line-height: 1.5;">
            <span style="color: #10b981; font-weight: 600;">📍 Hệ quả:</span> ${insight.implication}
          </p>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Gửi email từng người (liên kết hủy đăng ký cá nhân hóa)
   */
  async sendNewsletter(
    recipients: Recipient[],
    baseHtml: string,
  ): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend client not configured.');
    }

    const senderEmail = this.configService.get('RESEND_FROM_EMAIL');
    const replyToEmail = this.configService.get('REPLY_TO_EMAIL');
    const baseUrl = this.configService.get<string>('WEB_BASE_URL');
    const subject = this.getEmailSubject();

    if (!baseUrl) {
      this.logger.warn(
        'WEB_BASE_URL not configured. Unsubscribe links will be empty.',
      );
    }

    this.logger.log(
      `Starting individual email sending to ${recipients.length} recipients...`,
    );

    let successCount = 0;
    let failCount = 0;

    // Resend has a rate limit, but for batch sending they recommend batch API or just loop.
    // For simplicity in this migration, we loop.
    // Ideally we should use Resend's batch sending capabilities if list is large,
    // but the original code looped, so we keep the logic structure.

    for (const recipient of recipients) {
      try {
        // Tạo liên kết hủy đăng ký (sử dụng UUID)
        const unsubscribeLink = baseUrl
          ? `${baseUrl}/unsubscribe?id=${recipient.id}`
          : '#';

        // Tạo liên kết lưu trữ
        const archiveLink = baseUrl ? `${baseUrl}/archive` : '#';

        // Thay thế placeholder trong HTML
        const personalizedHtml = baseHtml
          .replace('{{UNSUBSCRIBE_URL}}', unsubscribeLink)
          .replace('{{ARCHIVE_URL}}', archiveLink);

        // Gửi email
        await this.resend.emails.send({
          from: senderEmail,
          to: recipient.email,
          replyTo: replyToEmail,
          subject,
          html: personalizedHtml,
          headers: {
            'List-Unsubscribe': `<${unsubscribeLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        successCount++;

        // Resend rate limits are generally higher than SES sandbox, but let's keep a small delay to be safe
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        failCount++;
        this.logger.error(
          `Failed to send to ${recipient.email.slice(0, 5)}...: ${error}`,
        );
      }
    }

    this.logger.log(
      `Email sending completed. Success: ${successCount}, Failed: ${failCount}`,
    );
  }

  /**
   * Get recipients with id from Supabase
   */
  async getRecipients(): Promise<Recipient[]> {
    try {
      const subscribers =
        await this.supabaseService.getActiveSubscribersWithId();

      if (subscribers.length === 0) {
        this.logger.warn('No active subscribers found in Supabase');
        return [];
      }

      this.logger.log(`Fetched ${subscribers.length} active subscriber(s)`);
      return subscribers;
    } catch (error) {
      this.logger.error(`Failed to fetch recipients from Supabase: ${error}`);
      throw error;
    }
  }
}
