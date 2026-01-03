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
   * RSS 피드에서 뉴스 아이템 수집
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

      // DEV MODE: 상세 로그
      if (this.devModeConfig.verboseLogging) {
        this.logger.log(`=== ${category.toUpperCase()} RSS Feed ===`);
        this.logger.log(`Total items: ${items.length}`);
        const showCount = Math.min(5, items.length);
        items.slice(0, showCount).forEach((item, i) => {
          this.logger.log(`  [${i}] ${item.title}`);
        });
        if (items.length > showCount) {
          this.logger.log(`  ... and ${items.length - showCount} more`);
        }
      }

      return items;
    } catch (error) {
      this.logger.error(`Failed to fetch RSS from ${url}`, error);
      return [];
    }
  }

  /**
   * 비즈니스/경제 뉴스 수집
   */
  async fetchBusinessNews(): Promise<NewsItem[]> {
    this.logger.log('Fetching business news...');
    const items = await this.fetchRss(
      GOOGLE_RSS_URLS.SECTION_BUSINESS,
      'business',
    );
    this.logger.log(`Fetched ${items.length} business news items`);

    if (items.length > 0) {
      this.logger.debug(`Sample: ${items[0].title}`);
    }

    return items;
  }

  /**
   * 기술/과학 뉴스 수집
   */
  async fetchTechNews(): Promise<NewsItem[]> {
    this.logger.log('Fetching tech news...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_TECH, 'tech');
    this.logger.log(`Fetched ${items.length} tech news items`);

    if (items.length > 0) {
      this.logger.debug(`Sample: ${items[0].title}`);
    }

    return items;
  }

  /**
   * 정책 뉴스 수집 (Custom Query)
   */
  async fetchPolicyNews(): Promise<NewsItem[]> {
    this.logger.log('Fetching policy news...');
    const url = GOOGLE_RSS_URLS.SEARCH_BASE.replace(
      '{KEYWORD}',
      CUSTOM_QUERIES.POLICY,
    );
    const items = await this.fetchRss(url, 'policy');
    this.logger.log(`Fetched ${items.length} policy news items`);

    if (items.length > 0) {
      this.logger.debug(`Sample: ${items[0].title}`);
    }

    return items;
  }

  /**
   * 글로벌/세계 뉴스 수집
   */
  async fetchWorldNews(): Promise<NewsItem[]> {
    this.logger.log('Fetching world news...');
    const items = await this.fetchRss(GOOGLE_RSS_URLS.SECTION_WORLD, 'world');
    this.logger.log(`Fetched ${items.length} world news items`);

    if (items.length > 0) {
      this.logger.debug(`Sample: ${items[0].title}`);
    }

    return items;
  }

  /**
   * 사설 수집
   * @param stance - 'conservative' (조중동) 또는 'liberal' (한경오)
   */
  async fetchEditorials(stance: EditorialStance): Promise<Editorial[]> {
    this.logger.log(`Fetching ${stance} editorials...`);

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

      this.logger.log(`Fetched ${editorials.length} ${stance} editorials`);

      // DEV MODE: 사설 상세 로그
      if (this.devModeConfig.verboseLogging) {
        const stanceLabel =
          stance === 'conservative' ? '보수 (조중동)' : '진보 (한경오)';
        this.logger.log(`=== ${stanceLabel} 사설 ===`);
        editorials.forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
      } else if (editorials.length > 0) {
        this.logger.debug(`Sample: ${editorials[0].title}`);
      }

      return editorials;
    } catch (error) {
      this.logger.error(`Failed to fetch ${stance} editorials`, error);
      return [];
    }
  }

  /**
   * 모든 카테고리 뉴스 수집
   */
  async fetchAllCategories(): Promise<CategorizedNews> {
    this.logger.log('Fetching all news categories...');

    const [business, tech, policy, world] = await Promise.all([
      this.fetchBusinessNews(),
      this.fetchTechNews(),
      this.fetchPolicyNews(),
      this.fetchWorldNews(),
    ]);

    const total = business.length + tech.length + policy.length + world.length;
    this.logger.log(`Total fetched: ${total} news items`);
    this.logger.log(
      `  - Business: ${business.length}, Tech: ${tech.length}, Policy: ${policy.length}, World: ${world.length}`,
    );

    return { business, tech, policy, world };
  }
}
