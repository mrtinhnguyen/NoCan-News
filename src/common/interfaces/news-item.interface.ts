import { NewsCategory } from '../constants';

/**
 * RSS에서 수집한 원본 뉴스 아이템
 */
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  snippet?: string;
  category: NewsCategory;
}

/**
 * AI 처리 후 가공된 뉴스 아이템
 */
export interface ProcessedNews {
  original: NewsItem;
  isToxic: boolean;
  rewrittenTitle?: string;
  insight?: {
    fact: string;
    context: string;
    implication: string;
  };
}

/**
 * 독성 콘텐츠 필터링 통계
 */
export interface FilterStats {
  totalScanned: number;
  blocked: {
    crime: number;
    gossip: number;
    politicalStrife: number;
  };
}

/**
 * 카테고리별로 분류된 뉴스
 */
export interface CategorizedNews {
  business: NewsItem[];
  tech: NewsItem[];
  society: NewsItem[];
  world: NewsItem[];
}

/**
 * AI 선별 결과 (카테고리별)
 */
export interface SelectionResult {
  filterStats: {
    scanned: number;
    blocked: {
      crime: number;
      gossip: number;
      politicalStrife: number;
    };
  };
  selectedIndices: number[];
}

/**
 * 스크래핑된 뉴스 (본문 포함)
 */
export interface ScrapedNews extends NewsItem {
  content: string;
}

/**
 * AI 인사이트 생성 결과
 */
export interface InsightResult {
  index: number; // 입력 뉴스 배열의 인덱스 (AI 응답 매핑용)
  detoxedTitle: string;
  insight: {
    fact: string;
    context: string;
    implication: string;
  };
}
