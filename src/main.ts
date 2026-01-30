import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NewsletterService } from './modules/newsletter/newsletter.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create standalone application (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    logger.log('Starting Morning News newsletter generation...');

    const newsletterService = app.get(NewsletterService);
    await newsletterService.run();

    logger.log('Newsletter process completed successfully!');
  } catch (error) {
    logger.error('Failed to generate newsletter', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

void bootstrap();
