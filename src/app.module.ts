import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { RssModule } from './modules/rss/rss.module';
import { AiModule } from './modules/ai/ai.module';
import { EmailModule } from './modules/email/email.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { IssueTrackingModule } from './modules/issue-tracking/issue-tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    RssModule,
    AiModule,
    EmailModule,
    NewsletterModule,
    ScraperModule,
    IssueTrackingModule,
  ],
})
export class AppModule {}
