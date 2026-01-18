/**
 * AWS SES 이메일 발송 테스트 스크립트
 * 사용법: npx ts-node src/test-email.ts your-email@example.com
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmailService } from './modules/email/email.service';

async function testEmail() {
  const logger = new Logger('TestEmail');
  const testRecipient = process.argv[2];

  if (!testRecipient) {
    logger.error(
      '사용법: npx ts-node src/test-email.ts your-email@example.com',
    );
    process.exit(1);
  }

  logger.log(`테스트 이메일 발송 시작: ${testRecipient}`);

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const emailService = app.get(EmailService);

    // 테스트용 간단한 HTML
    const testHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; padding: 20px;">
  <h1>🔇 NoCan News - AWS SES 테스트</h1>
  <p>AWS SES 이메일 발송이 정상적으로 작동합니다!</p>
  <hr>
  <p style="color: #666; font-size: 12px;">
    발송 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
  </p>
  <a href="{{UNSUBSCRIBE_URL}}">수신거부</a>
</body>
</html>
    `.trim();

    // 테스트 수신자 (ID는 임의값)
    const recipients = [{ id: 'test-id', email: testRecipient }];

    await emailService.sendNewsletter(recipients, testHtml);

    logger.log('✅ 테스트 이메일 발송 완료!');
  } catch (error) {
    logger.error('❌ 테스트 이메일 발송 실패:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

void testEmail();
