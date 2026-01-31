import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import {
  CUSTOM_QUERIES,
  EditorialStance,
  GOOGLE_RSS_URLS,
  NewsCategory,
} from '../../common/constants';
import { CategorizedNews, Editorial, NewsItem } from '../../common/interfaces';

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
}

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);
  private readonly parser: Parser;

  constructor(private readonly devModeConfig: DevModeConfig) {
    this.parser = new Parser();
  }

  /**
   * Thu thập mục tin tức từ RSS feed
   */
  private async fetchRss(
    url: string,
    category: NewsCategory,
  ): Promise<NewsItem[]> {
    try {
      const feed = await this.parser.parseURL(url);

      const items = feed.items.map((item: RssItem) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        snippet: item.contentSnippet || '',
        category,
      }));

      // DEV MODE: Log chi tiết
      if (this.devModeConfig.verboseLogging) {
        this.logger.log(`=== RSS Feed ${category.toUpperCase()} ===`);
        this.logger.log(`Tổng số mục: ${items.length}`);
        const showCount = Math.min(5, items.length);
        items.slice(0, showCount).forEach((item, i) => {
          this.logger.log(`  [${i}] ${item.title}`);
        });
        if (items.length > showCount) {
          this.logger.log(`  ... và ${items.length - showCount} mục khác`);
        }
      }

      return items;
    } catch (error) {
      this.logger.error(`Không thể thu thập RSS từ ${url}`, error);
      return [];
    }
  }

  /**
   * Thu thập tin tức Kinh doanh/Kinh tế
   */
  async fetchBusinessNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức kinh doanh...');
    const items = await this.fetchRss(
      GOOGLE_RSS_URLS.SECTION_BUSINESS,
      'business',
    );
    this.logger.log(`Đã thu thập ${items.length} tin tức kinh doanh`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập tin tức Công nghệ/Khoa học
   */
  async fetchTechNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức công nghệ...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_TECH, 'tech');
    this.logger.log(`Đã thu thập ${items.length} tin tức công nghệ`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập tin tức Xã hội (Danh mục Việt Nam)
   */
  async fetchSocietyNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức xã hội (Việt Nam)...');
    const items = await this.fetchRss(
      GOOGLE_RSS_URLS.SECTION_VIETNAM,
      'society',
    );
    this.logger.log(`Đã thu thập ${items.length} tin tức xã hội`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập tin tức Thế giới/Toàn cầu
   */
  async fetchWorldNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức thế giới...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_WORLD, 'world');
    this.logger.log(`Đã thu thập ${items.length} tin tức thế giới`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập tin tức Trí tuệ Nhân tạo (AI)
   */
  async fetchAiNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức AI...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_AI, 'ai');
    this.logger.log(`Đã thu thập ${items.length} tin tức AI`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập tin tức Crypto (Tiền điện tử)
   */
  async fetchCryptoNews(): Promise<NewsItem[]> {
    this.logger.log('Đang thu thập tin tức Crypto...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_CRYPTO, 'crypto');
    this.logger.log(`Đã thu thập ${items.length} tin tức Crypto`);

    if (items.length > 0) {
      this.logger.debug(`Mẫu: ${items[0].title}`);
    }

    return items;
  }

  /**
   * Thu thập xã luận
   * @param stance - 'conservative' (Nhóm 1) hoặc 'liberal' (Nhóm 2)
   */
  async fetchEditorials(stance: EditorialStance): Promise<Editorial[]> {
    this.logger.log(`Đang thu thập xã luận ${stance}...`);

    const query =
      stance === 'conservative'
        ? CUSTOM_QUERIES.EDITORIAL_CONSERVATIVE
        : CUSTOM_QUERIES.EDITORIAL_LIBERAL;

    const url = GOOGLE_RSS_URLS.SEARCH_BASE.replace('{KEYWORD}', query);

    try {
      const feed = await this.parser.parseURL(url);

      const editorials: Editorial[] = feed.items.map((item: RssItem) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        stance,
      }));

      this.logger.log(`Đã thu thập ${editorials.length} bài xã luận ${stance}`);

      // DEV MODE: Log chi tiết xã luận
      if (this.devModeConfig.verboseLogging) {
        const stanceLabel =
          stance === 'conservative'
            ? 'Nhóm 1 (VnExpress/Dân Trí)'
            : 'Nhóm 2 (Tuổi Trẻ/Thanh Niên)';
        this.logger.log(`=== Xã luận ${stanceLabel} ===`);
        editorials.forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
      } else if (editorials.length > 0) {
        this.logger.debug(`Mẫu: ${editorials[0].title}`);
      }

      return editorials;
    } catch (error) {
      this.logger.error(`Thu thập xã luận ${stance} thất bại`, error);
      return [];
    }
  }

  /**
   * Thu thập tin tức tất cả danh mục
   */
  async fetchAllCategories(): Promise<CategorizedNews> {
    this.logger.log('Đang thu thập tất cả danh mục tin tức...');

    const [business, tech, society, world, ai, crypto] = await Promise.all([
      this.fetchBusinessNews(),
      this.fetchTechNews(),
      this.fetchSocietyNews(),
      this.fetchWorldNews(),
      this.fetchAiNews(),
      this.fetchCryptoNews(),
    ]);

    const total =
      business.length +
      tech.length +
      society.length +
      world.length +
      ai.length +
      crypto.length;
    this.logger.log(`Tổng số tin đã thu thập: ${total}`);
    this.logger.log(
      `  - Kinh doanh: ${business.length}, Công nghệ: ${tech.length}, Xã hội: ${society.length}, Thế giới: ${world.length}, AI: ${ai.length}, Crypto: ${crypto.length}`,
    );

    return { business, tech, society, world, ai, crypto };
  }
}
