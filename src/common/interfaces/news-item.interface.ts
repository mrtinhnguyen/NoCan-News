import { NewsCategory } from '../constants';

/**
 * Mục tin tức gốc thu thập từ RSS
 */
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  snippet?: string;
  category: NewsCategory;
}

/**
 * Mục tin tức đã qua xử lý AI
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
 * Thống kê lọc nội dung độc hại
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
 * Tin tức đã phân loại theo danh mục
 */
export interface CategorizedNews {
  business: NewsItem[];
  tech: NewsItem[];
  society: NewsItem[];
  world: NewsItem[];
  ai: NewsItem[];
  crypto: NewsItem[];
}

/**
 * Kết quả chọn lọc AI (theo danh mục)
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
 * Tin tức đã cào (bao gồm nội dung)
 */
export interface ScrapedNews extends NewsItem {
  content: string;
}

/**
 * Kết quả tạo insight AI
 */
export interface InsightResult {
  index: number; // Index của mảng tin tức đầu vào (để ánh xạ phản hồi AI)
  detoxedTitle: string;
  insight: {
    fact: string;
    context: string;
    implication: string;
  };
  isFallback?: boolean; // Sử dụng giá trị fallback khi AI thất bại
}
