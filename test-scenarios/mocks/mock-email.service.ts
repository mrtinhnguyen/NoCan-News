import { Injectable } from '@nestjs/common';
import { mockSubscribers } from '../fixtures/subscribers.fixture';

@Injectable()
export class MockEmailService {
  async getRecipients() {
    console.log(`[MockEmailService] getRecipients`);
    return mockSubscribers;
  }

  renderNewsletter(data: any): string {
    console.log(`[MockEmailService] renderNewsletter`);
    // 간단한 HTML 생성 (실제 렌더링 로직 생략)
    return `<html><body><h1>Mock Newsletter</h1><p>${data.processedNews.length} news items</p></body></html>`;
  }

  async sendNewsletter(recipients: any[], html: string) {
    console.log(
      `[MockEmailService] sendNewsletter to ${recipients.length} recipients`,
    );
    console.log(`[MockEmailService] Email content length: ${html.length} bytes`);
    // 실제 발송 없음
    return { sent: recipients.length, failed: 0 };
  }
}
