import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IssueTrackingService } from './issue-tracking.service';

@Module({
  imports: [SupabaseModule, AiModule],
  providers: [IssueTrackingService],
  exports: [IssueTrackingService],
})
export class IssueTrackingModule {}
