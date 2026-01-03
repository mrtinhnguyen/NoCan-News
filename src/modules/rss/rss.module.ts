import { Module } from '@nestjs/common';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { RssService } from './rss.service';

@Module({
  providers: [DevModeConfig, RssService],
  exports: [RssService],
})
export class RssModule {}
