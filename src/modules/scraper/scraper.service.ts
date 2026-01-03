import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Readability } from '@mozilla/readability';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { NewsItem, ScrapedNews } from '../../common/interfaces';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly model: GenerativeModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly devModeConfig: DevModeConfig,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      this.logger.log('Scraper AI model initialized: gemini-1.5-flash');
    } else {
      this.logger.warn('GEMINI_API_KEY not found - AI fallback disabled');
    }
  }

  /**
   * Google News 페이지에서 batchexecute API 호출에 필요한 파라미터 추출
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
   * Google batchexecute API를 사용하여 URL 디코딩
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

      // 응답에서 URL 추출 (JSON 이스케이프 해제 후)
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
   * Google News 리다이렉트 URL에서 실제 기사 URL 추출
   * 1. Base64 디코딩 시도 (레거시 형식, 네트워크 요청 없음)
   * 2. batchexecute API (새로운 AU_yqL 형식)
   * 3. 원본 URL 반환 (fallback)
   */
  private async resolveGoogleNewsUrl(googleUrl: string): Promise<string> {
    // Google News URL이 아니면 그대로 반환
    if (!googleUrl.includes('news.google.com')) {
      return googleUrl;
    }

    const articleId = googleUrl.match(/\/articles\/([^?]+)/)?.[1];
    if (!articleId) {
      return googleUrl;
    }

    try {
      // 1. Base64 디코딩 시도 (레거시 형식)
      const decoded = Buffer.from(articleId, 'base64').toString('latin1');
      let str = decoded;

      // 접두사 제거 [0x08, 0x13, 0x22]
      const prefix = String.fromCharCode(0x08, 0x13, 0x22);
      if (str.startsWith(prefix)) {
        str = str.substring(prefix.length);
      }

      // 접미사 제거 [0xd2, 0x01, 0x00]
      const suffix = String.fromCharCode(0xd2, 0x01, 0x00);
      if (str.endsWith(suffix)) {
        str = str.substring(0, str.length - suffix.length);
      }

      // 길이 바이트 파싱
      const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
      const len = bytes[0];

      if (len >= 0x80) {
        str = str.substring(2, len - 0x80 + 2);
      } else {
        str = str.substring(1, len + 1);
      }

      // 레거시 형식: 직접 URL이 포함된 경우
      if (str.startsWith('http://') || str.startsWith('https://')) {
        this.logger.debug(`Base64 decoded URL: ${str}`);
        return str;
      }

      // 2. 새로운 형식 (AU_yqL): batchexecute API 사용
      this.logger.debug('새로운 형식 감지, batchexecute API 호출');
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

      this.logger.warn(`URL 디코딩 실패: ${googleUrl}`);
      return googleUrl;
    } catch {
      this.logger.warn(`Failed to resolve URL: ${googleUrl}`);
      return googleUrl;
    }
  }

  /**
   * Arc Publishing (Fusion) 사이트에서 JSON으로 본문 추출
   * 조선일보, 조선비즈 등 Fusion 플랫폼 사용 사이트 대응
   */
  private extractFromFusionJson(html: string): string | null {
    try {
      // Fusion.globalContent JSON 찾기
      const fusionMatch = html.match(
        /Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});?\s*Fusion\./,
      );
      if (!fusionMatch) {
        return null;
      }

      const jsonStr = fusionMatch[1];
      const globalContent = JSON.parse(jsonStr);

      // content_elements 배열에서 텍스트 추출
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
   * AI를 사용하여 HTML에서 본문 추출 (Readability 실패 시 fallback)
   */
  private async extractContentWithAI(html: string): Promise<string | null> {
    // DEV MODE: AI 비활성화 시 스킵
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
      const prompt = `아래 HTML에서 뉴스 기사 본문만 추출해주세요.
광고, 메뉴, 푸터, 관련 기사 등은 제외하고 순수 기사 내용만 텍스트로 반환하세요.
본문이 없으면 "NO_CONTENT"를 반환하세요.

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
   * 뉴스 기사 본문 스크래핑 (Readability → AI fallback)
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
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const html = response.data;

      if (isVerbose) {
        this.logger.log(`  HTML Length: ${html.length} chars`);
      }

      // 1. Readability로 본문 추출 시도
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

      // 2. Readability 실패 시 Fusion JSON → AI fallback
      if (!readabilitySuccess) {
        // 2-1. Fusion JSON 추출 시도 (조선계열 등 Arc Publishing 사이트)
        const fusionContent = this.extractFromFusionJson(html);
        if (fusionContent) {
          content = fusionContent;
          if (isVerbose) {
            this.logger.log(`  [SUCCESS] Fusion JSON: ${content.length} chars`);
          } else {
            this.logger.debug(`Fusion JSON 본문 추출 성공: ${actualUrl}`);
          }
        } else {
          // 2-2. AI fallback
          if (isVerbose) {
            this.logger.log(`  Trying AI fallback...`);
          } else {
            this.logger.debug(
              `Readability 실패, AI fallback 시도: ${actualUrl}`,
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
              this.logger.debug(`AI 본문 추출 성공: ${actualUrl}`);
            }
          } else if (isVerbose) {
            this.logger.log(`  [FAIL] AI fallback returned null`);
          }
        }
      }

      // 최소 길이 확인
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
          this.logger.warn(`본문 추출 실패: ${actualUrl}`);
        }
        return '';
      }

      // 최대 길이 제한 (토큰 절약)
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
        this.logger.error(`Failed to scrape: ${url}`, error);
      }
      return '';
    }
  }

  /**
   * 여러 뉴스 기사 본문 스크래핑
   * 본문 추출 실패한 기사는 제외됨
   */
  async scrapeMultipleArticles(newsItems: NewsItem[]): Promise<ScrapedNews[]> {
    this.logger.log(`Scraping ${newsItems.length} articles...`);

    const results: ScrapedNews[] = [];

    for (const item of newsItems) {
      const content = await this.scrapeArticle(item.link);

      // 본문 추출 성공한 기사만 포함
      if (content.length >= 100) {
        results.push({
          ...item,
          content,
        });
      } else {
        this.logger.warn(`기사 제외 (본문 없음): ${item.title}`);
      }

      // 요청 간 딜레이 (서버 부담 줄이기)
      await this.delay(500);
    }

    this.logger.log(
      `Scraped ${results.length}/${newsItems.length} articles successfully`,
    );

    return results;
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
