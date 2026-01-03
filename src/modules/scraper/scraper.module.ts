import { Module } from '@nestjs/common';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { ScraperService } from './scraper.service';

@Module({
  providers: [DevModeConfig, ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
