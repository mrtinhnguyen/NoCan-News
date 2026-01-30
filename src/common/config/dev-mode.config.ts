import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service cấu hình chế độ phát triển (Dev Mode)
 *
 * Biến môi trường:
 * - DEV_MODE: Bật chế độ phát triển (true/false)
 * - DEV_AI_ENABLED: Bật AI trong dev mode (true/false)
 * - NEWSLETTER_DRY_RUN: Bỏ qua gửi email (cũ)
 */
@Injectable()
export class DevModeConfig {
  private readonly logger = new Logger(DevModeConfig.name);

  /** Trạng thái kích hoạt Dev Mode */
  readonly isDevMode: boolean;

  /** Trạng thái kích hoạt AI (mặc định tắt trong dev mode) */
  readonly isAiEnabled: boolean;

  /** Trạng thái bỏ qua gửi email */
  readonly skipEmail: boolean;

  /** Trạng thái log chi tiết */
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
   * Lấy API Key Gemini phù hợp với môi trường
   * Nếu DEV_MODE=true thì dùng GEMINI_API_KEY_DEV, ngược lại dùng GEMINI_API_KEY
   */
  getGeminiApiKey(): string | undefined {
    const key = this.isDevMode
      ? this.configService.get<string>('GEMINI_API_KEY_DEV')
      : this.configService.get<string>('GEMINI_API_KEY');

    if (this.isDevMode && key) {
      this.logger.log('Using GEMINI_API_KEY_DEV (development key)');
    }

    return key;
  }

  /**
   * In banner chế độ Dev
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
