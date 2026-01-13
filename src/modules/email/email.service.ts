import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NewsletterData, ProcessedNews } from '../../common/interfaces';
import { SupabaseService } from '../supabase/supabase.service';

export interface Recipient {
  id: string;
  email: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const user = this.configService.get<string>('GMAIL_USER');
    const pass = this.configService.get<string>('GMAIL_PASS');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      this.logger.log('Email transporter initialized');
    } else {
      this.logger.warn(
        'Gmail credentials not configured. Email sending disabled.',
      );
    }
  }

  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      business: '경제',
      tech: '기술',
      society: '사회',
      world: '국제',
    };
    return names[category] || category;
  }

  /**
   * 이메일 제목 생성
   */
  getEmailSubject(): string {
    const today = new Date()
      .toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\. /g, '-')
      .replace(/\./g, '');

    return `🔇 NoCan News - ${today} | 오늘의 뉴스`;
  }

  /**
   * 뉴스레터 HTML 렌더링
   * Footer에 {{UNSUBSCRIBE_URL}} 플레이스홀더 포함
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
            ⚖️ 오늘의 사설 분석
          </h2>
          <p style="font-size: 16px; font-weight: 600; color: #343a40; margin-bottom: 12px;">
            ${editorialSynthesis.topic}
          </p>
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #495057; margin: 0;">
              <strong>🔴 핵심 쟁점:</strong> ${editorialSynthesis.conflict}
            </p>
          </div>
          <div style="background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #c92a2a; font-weight: 600; margin: 0 0 8px 0;">보수 측 논리</p>
            <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentA}</p>
          </div>
          <div style="background: #e7f5ff; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <p style="font-size: 14px; color: #1971c2; font-weight: 600; margin: 0 0 8px 0;">진보 측 논리</p>
            <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentB}</p>
          </div>
          <div style="background: #f1f3f5; padding: 12px; border-radius: 8px;">
            <p style="font-size: 13px; color: #495057; margin: 0;">
              <strong>💡 구조적 의미:</strong> ${editorialSynthesis.synthesis}
            </p>
          </div>
        </div>
      `;
    }

    return `
<!DOCTYPE html>
<html lang="ko">
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
        세상의 소음은 끄고, 구조적 맥락만 남긴다
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
        ${date}
      </p>
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
        NoCan News는 AI가 큐레이션하는 뉴스레터입니다.
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">
        Powered by Gemini AI • Noise Off, Context On
      </p>

      <!-- Unsubscribe Link Placeholder -->
      <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af; font-size: 11px; text-decoration: underline;">
        수신거부 (Unsubscribe)
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
            <span style="color: #3b82f6; font-weight: 600;">📍 Fact:</span> ${insight.fact}
          </p>
          <p style="font-size: 13px; color: #374151; margin: 0 0 8px 0; line-height: 1.5;">
            <span style="color: #f59e0b; font-weight: 600;">📍 Context:</span> ${insight.context}
          </p>
          <p style="font-size: 13px; color: #374151; margin: 0; line-height: 1.5;">
            <span style="color: #10b981; font-weight: 600;">📍 Implication:</span> ${insight.implication}
          </p>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * 이메일 개별 발송 (각 수신자마다 개인화된 수신거부 링크)
   */
  async sendNewsletter(
    recipients: Recipient[],
    baseHtml: string,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not configured.');
    }

    const senderEmail = this.configService.get('GMAIL_USER');
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

    for (const recipient of recipients) {
      try {
        // 수신 거부 링크 생성 (UUID 사용)
        const unsubscribeLink = baseUrl
          ? `${baseUrl}/unsubscribe?id=${recipient.id}`
          : '#';

        // HTML 내의 플레이스홀더를 실제 링크로 교체
        const personalizedHtml = baseHtml.replace(
          '{{UNSUBSCRIBE_URL}}',
          unsubscribeLink,
        );

        // 개별 발송
        await this.transporter.sendMail({
          from: `"NoCan News" <${senderEmail}>`,
          to: recipient.email,
          subject,
          html: personalizedHtml,
          headers: {
            'List-Unsubscribe': `<${unsubscribeLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        successCount++;

        // Gmail API 제한 방지를 위한 딜레이 (500ms)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        failCount++;
        this.logger.error(`Failed to send to ${recipient.email}: ${error}`);
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
