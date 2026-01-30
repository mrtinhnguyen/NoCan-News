/**
 * Script kiểm tra gửi email qua Resend
 * Cách dùng: npx ts-node src/test-email.ts your-email@example.com
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
      'Cách dùng: npx ts-node src/test-email.ts your-email@example.com',
    );
    process.exit(1);
  }

  logger.log(`Bắt đầu gửi email kiểm tra: ${testRecipient}`);

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const emailService = app.get(EmailService);

    // HTML đơn giản để kiểm tra
    const testHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; padding: 20px;">
  <h1>🔇 Morning News - Kiểm tra Resend</h1>
  <p>Gửi email qua Resend hoạt động bình thường!</p>
  <hr>
  <p style="color: #666; font-size: 12px;">
    Thời gian gửi: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
  </p>
  <a href="{{UNSUBSCRIBE_URL}}">Hủy đăng ký</a>
</body>
</html>
    `.trim();

    // Người nhận kiểm tra (ID ngẫu nhiên)
    const recipients = [{ id: 'test-id', email: testRecipient }];

    await emailService.sendNewsletter(recipients, testHtml);

    logger.log('✅ Gửi email kiểm tra hoàn tất!');
  } catch (error) {
    logger.error('❌ Gửi email kiểm tra thất bại:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

void testEmail();
