import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Readability } from '@mozilla/readability';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { NewsItem, ScrapedNews } from '../../common/interfaces';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly model: GenerativeModel;

  constructor(private readonly devModeConfig: DevModeConfig) {
    const apiKey = this.devModeConfig.getGeminiApiKey();
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      this.logger.log('Scraper AI model initialized: gemini-2.5-flash-lite');
    } else {
      this.logger.warn('GEMINI_API_KEY not found - AI fallback disabled');
    }
  }

  /**
   * Trích xuất các tham số cần thiết cho cuộc gọi API batchexecute từ trang Google News
   */
  private async getDecodingParams(
    articleId: string,
  ): Promise<{ signature: string; timestamp: string } | null> {
    try {
      const response = await axios.get<string>(
        `https://news.google.com/rss/articles/${articleId}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
      );

      const $ = cheerio.load(response.data);
      const div = $('c-wiz > div').first();

      const signature = div.attr('data-n-a-sg');
      const timestamp = div.attr('data-n-a-ts');

      if (signature && timestamp) {
        return { signature, timestamp };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Giải mã URL bằng Google batchexecute API
   */
  private async decodeWithBatchExecute(
    articleId: string,
    signature: string,
    timestamp: string,
  ): Promise<string | null> {
    const innerPayload = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"KR:ko",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${timestamp},"${signature}"]`;
    const payload = JSON.stringify([[['Fbv4je', innerPayload]]]);

    try {
      const response = await axios.post<string>(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute',
        `f.req=${encodeURIComponent(payload)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          timeout: 15000,
        },
      );

      // Trích xuất URL từ phản hồi (sau khi loại bỏ JSON escape)
      const unescapedData = response.data
        .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        )
        .replace(/\\"/g, '"')
        .replace(/\\\//g, '/');
      const urlPattern = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;
      const matches = unescapedData.match(urlPattern);

      if (matches) {
        for (const url of matches) {
          if (
            !url.includes('news.google.com') &&
            !url.includes('gstatic.com')
          ) {
            return url;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Trích xuất URL bài báo thực tế từ URL chuyển hướng Google News
   * 1. Thử giải mã Base64 (định dạng cũ, không cần request mạng)
   * 2. batchexecute API (định dạng AU_yqL mới)
   * 3. Trả về URL gốc (fallback)
   */
  private async resolveGoogleNewsUrl(googleUrl: string): Promise<string> {
    // Nếu không phải URL Google News thì trả về nguyên trạng
    if (!googleUrl.includes('news.google.com')) {
      return googleUrl;
    }

    const articleId = googleUrl.match(/\/articles\/([^?]+)/)?.[1];
    if (!articleId) {
      return googleUrl;
    }

    try {
      // 1. Thử giải mã Base64 (định dạng cũ)
      const decoded = Buffer.from(articleId, 'base64').toString('latin1');
      let str = decoded;

      // Xóa tiền tố [0x08, 0x13, 0x22]
      const prefix = String.fromCharCode(0x08, 0x13, 0x22);
      if (str.startsWith(prefix)) {
        str = str.substring(prefix.length);
      }

      // Xóa hậu tố [0xd2, 0x01, 0x00]
      const suffix = String.fromCharCode(0xd2, 0x01, 0x00);
      if (str.endsWith(suffix)) {
        str = str.substring(0, str.length - suffix.length);
      }

      // Phân tích byte độ dài
      const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
      const len = bytes[0];

      if (len >= 0x80) {
        str = str.substring(2, len - 0x80 + 2);
      } else {
        str = str.substring(1, len + 1);
      }

      // Định dạng cũ: khi chứa URL trực tiếp
      if (str.startsWith('http://') || str.startsWith('https://')) {
        this.logger.debug(`Base64 decoded URL: ${str}`);
        return str;
      }

      // 2. Định dạng mới (AU_yqL): sử dụng batchexecute API
      this.logger.debug('Phát hiện định dạng mới, đang gọi API batchexecute');
      const params = await this.getDecodingParams(articleId);

      if (params) {
        const decodedUrl = await this.decodeWithBatchExecute(
          articleId,
          params.signature,
          params.timestamp,
        );

        if (decodedUrl) {
          this.logger.debug(`batchexecute decoded URL: ${decodedUrl}`);
          return decodedUrl;
        }
      }

      this.logger.warn(`Giải mã URL thất bại: ${googleUrl}`);
      return googleUrl;
    } catch {
      this.logger.warn(`Failed to resolve URL: ${googleUrl}`);
      return googleUrl;
    }
  }

  /**
   * Trích xuất nội dung dưới dạng JSON từ các trang Arc Publishing (Fusion)
   * Hỗ trợ các trang sử dụng nền tảng Fusion như Chosun Ilbo, Chosun Biz
   */
  private extractFromFusionJson(html: string): string | null {
    try {
      // Tìm JSON Fusion.globalContent
      const fusionMatch = html.match(
        /Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});?\s*Fusion\./,
      );
      if (!fusionMatch) {
        return null;
      }

      const jsonStr = fusionMatch[1];
      const globalContent = JSON.parse(jsonStr);

      // Trích xuất văn bản từ mảng content_elements
      const contentElements = globalContent.content_elements;
      if (!Array.isArray(contentElements)) {
        return null;
      }

      const textContents = contentElements
        .filter(
          (el: { type: string; content?: string }) =>
            el.type === 'text' && el.content,
        )
        .map((el: { content: string }) => el.content)
        .join('\n\n');

      if (textContents.length >= 100) {
        this.logger.debug(
          `Fusion JSON extracted: ${textContents.length} chars`,
        );
        return textContents;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sử dụng AI để trích xuất nội dung từ HTML (fallback khi Readability thất bại)
   */
  private async extractContentWithAI(html: string): Promise<string | null> {
    // DEV MODE: Bỏ qua nếu AI bị vô hiệu hóa
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] AI fallback disabled - skipping');
      return null;
    }

    if (!this.model) {
      this.logger.warn('AI fallback skipped: model not initialized');
      return null;
    }

    if (html.length < 500) {
      this.logger.warn(
        `AI fallback skipped: HTML too short (${html.length} chars)`,
      );
      return null;
    }

    try {
      const prompt = `Hãy trích xuất nội dung chính của bài báo từ HTML bên dưới.
Loại bỏ quảng cáo, menu, footer, các bài viết liên quan, v.v. và chỉ trả về nội dung văn bản thuần túy của bài báo.
Nếu không có nội dung, hãy trả về "NO_CONTENT".

HTML:
${html.slice(0, 15000)}`;

      this.logger.debug('Calling Gemini API for content extraction...');
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      this.logger.log(
        `AI response received (${text.length} chars): "${text.slice(0, 100)}..."`,
      );

      if (text === 'NO_CONTENT' || text.length < 100) {
        this.logger.warn('AI returned NO_CONTENT or insufficient content');
        return null;
      }

      this.logger.debug(`AI extracted ${text.length} chars`);
      return text;
    } catch (error) {
      this.logger.error('AI content extraction failed', error);
      return null;
    }
  }

  /**
   * Cào nội dung bài viết tin tức (Readability → AI fallback)
   */
  async scrapeArticle(url: string): Promise<string> {
    const isVerbose = this.devModeConfig.verboseLogging;

    if (isVerbose) {
      this.logger.log(`--- Scraping: ${url} ---`);
    }

    try {
      const actualUrl = await this.resolveGoogleNewsUrl(url);
      const urlDecodeSuccess = actualUrl !== url;

      if (isVerbose) {
        this.logger.log(`  Resolved URL: ${actualUrl}`);
        this.logger.log(
          `  URL Decode: ${urlDecodeSuccess ? 'SUCCESS' : 'SAME (direct URL)'}`,
        );
      } else {
        this.logger.debug(`Scraping: ${actualUrl}`);
      }

      const response = await axios.get<string>(actualUrl, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const html = response.data;

      if (isVerbose) {
        this.logger.log(`  HTML Length: ${html.length} chars`);
      }

      // 1. Thử dùng Readability để trích xuất nội dung
      const dom = new JSDOM(html, { url: actualUrl });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      let content = article?.textContent?.trim() || '';
      const readabilitySuccess = content.length >= 100;

      if (isVerbose) {
        if (readabilitySuccess) {
          this.logger.log(`  [SUCCESS] Readability: ${content.length} chars`);
        } else {
          this.logger.log(
            `  [WARN] Readability failed: ${content.length} chars (< 100)`,
          );
        }
      }

      // 2. Nếu Readability thất bại → Fusion JSON → AI fallback
      if (!readabilitySuccess) {
        // 2-1. Thử trích xuất Fusion JSON (cho các trang như Chosun)
        const fusionContent = this.extractFromFusionJson(html);
        if (fusionContent) {
          content = fusionContent;
          if (isVerbose) {
            this.logger.log(`  [SUCCESS] Fusion JSON: ${content.length} chars`);
          } else {
            this.logger.debug(
              `Trích xuất nội dung Fusion JSON thành công: ${actualUrl}`,
            );
          }
        } else {
          // 2-2. AI fallback
          if (isVerbose) {
            this.logger.log(`  Trying AI fallback...`);
          } else {
            this.logger.debug(
              `Readability thất bại, thử AI fallback: ${actualUrl}`,
            );
          }

          const aiContent = await this.extractContentWithAI(html);
          if (aiContent) {
            content = aiContent;
            if (isVerbose) {
              this.logger.log(
                `  [SUCCESS] AI fallback: ${content.length} chars`,
              );
            } else {
              this.logger.debug(
                `Trích xuất nội dung bằng AI thành công: ${actualUrl}`,
              );
            }
          } else if (isVerbose) {
            this.logger.log(`  [FAIL] AI fallback returned null`);
          }
        }
      }

      // Kiểm tra độ dài tối thiểu
      if (content.length < 100) {
        if (isVerbose) {
          this.logger.log(
            `  [FAIL] Final content too short: ${content.length} chars`,
          );
          this.logger.log(`  Failure Summary:`);
          this.logger.log(
            `    - URL decode: ${urlDecodeSuccess ? 'OK' : 'N/A'}`,
          );
          this.logger.log(`    - HTML length: ${html.length} chars`);
          this.logger.log(
            `    - Readability: ${article ? 'parsed but empty/short' : 'parse failed'}`,
          );
          this.logger.log(
            `    - AI fallback: ${this.devModeConfig.isAiEnabled ? 'failed' : 'disabled'}`,
          );
        } else {
          this.logger.warn(`Trích xuất nội dung thất bại: ${actualUrl}`);
        }
        return '';
      }

      // Giới hạn độ dài tối đa (tiết kiệm token)
      if (content.length > 3000) {
        content = content.slice(0, 3000) + '...';
      }

      return content;
    } catch (error) {
      if (isVerbose) {
        this.logger.log(
          `  [ERROR] Request failed: ${(error as Error).message}`,
        );
      } else {
        this.logger.error(`Thất bại khi cào: ${url}`, error);
      }
      return '';
    }
  }

  /**
   * Cào nội dung nhiều bài báo
   * Các bài thất bại sẽ bị loại bỏ
   */
  async scrapeMultipleArticles(newsItems: NewsItem[]): Promise<ScrapedNews[]> {
    this.logger.log(`Đang cào ${newsItems.length} bài báo...`);

    const results: ScrapedNews[] = [];

    for (const item of newsItems) {
      const content = await this.scrapeArticle(item.link);

      // Chỉ bao gồm các bài cào thành công
      if (content.length >= 100) {
        results.push({
          ...item,
          content,
        });
      } else {
        this.logger.warn(`Loại bỏ bài viết (không có nội dung): ${item.title}`);
      }

      // Delay giữa các request (giảm tải server)
      await this.delay(500);
    }

    this.logger.log(
      `Đã cào thành công ${results.length}/${newsItems.length} bài báo`,
    );

    return results;
  }

  /**
   * Hàm delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
