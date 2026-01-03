import { Module } from '@nestjs/common';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { AiService } from './ai.service';

@Module({
  providers: [DevModeConfig, AiService],
  exports: [AiService],
})
export class AiModule {}
