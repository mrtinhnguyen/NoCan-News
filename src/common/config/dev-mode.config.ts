import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 개발 모드 설정 서비스
 *
 * 환경변수:
 * - DEV_MODE: 개발 모드 활성화 (true/false)
 * - DEV_AI_ENABLED: dev mode에서 AI 실행 여부 (true/false)
 * - NEWSLETTER_DRY_RUN: 이메일 발송 스킵 (기존)
 */
@Injectable()
export class DevModeConfig {
  private readonly logger = new Logger(DevModeConfig.name);

  /** 개발 모드 활성화 여부 */
  readonly isDevMode: boolean;

  /** AI 호출 활성화 여부 (dev mode에서는 기본 비활성화) */
  readonly isAiEnabled: boolean;

  /** 이메일 발송 스킵 여부 */
  readonly skipEmail: boolean;

  /** 상세 로그 출력 여부 */
  readonly verboseLogging: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevMode = this.configService.get('DEV_MODE') === 'true';
    this.isAiEnabled =
      !this.isDevMode || this.configService.get('DEV_AI_ENABLED') === 'true';
    this.skipEmail =
      this.isDevMode || this.configService.get('NEWSLETTER_DRY_RUN') === 'true';
    this.verboseLogging = this.isDevMode;

    if (this.isDevMode) {
      this.logger.log('Development mode initialized');
      this.logger.log(`  AI Enabled: ${this.isAiEnabled}`);
      this.logger.log(`  Skip Email: ${this.skipEmail}`);
      this.logger.log(`  Verbose Logging: ${this.verboseLogging}`);
    }
  }

  /**
   * dev mode 배너 출력
   */
  printBanner(): void {
    if (!this.isDevMode) return;

    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║            DEV MODE ACTIVATED                  ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(
      `║  AI Enabled: ${this.isAiEnabled ? 'YES' : 'NO (mock responses)'}`.padEnd(
        49,
      ) + '║',
    );
    console.log(
      `║  Email: ${this.skipEmail ? 'DISABLED' : 'ENABLED'}`.padEnd(49) + '║',
    );
    console.log(
      `║  Verbose Log: ${this.verboseLogging ? 'ON' : 'OFF'}`.padEnd(49) + '║',
    );
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
  }
}
