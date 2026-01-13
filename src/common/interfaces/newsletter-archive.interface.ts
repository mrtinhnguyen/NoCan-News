import { NewsCategory } from '../constants';

export interface BlockedCounts {
  crime: number;
  gossip: number;
  political_noise: number;
}

export interface FilterStatsData {
  total_scanned: number;
  blocked_counts: BlockedCounts;
}

export interface InsightData {
  fact: string;
  context: string;
  implication: string;
}

export interface NewsItemData {
  category: NewsCategory;
  original_title: string;
  refined_title: string;
  link: string;
  insight: InsightData;
}

export interface PerspectivesData {
  conservative: string;
  liberal: string;
}

export interface EditorialAnalysisData {
  topic: string;
  key_issue: string;
  perspectives: PerspectivesData;
  synthesis: string;
}

export interface ContentData {
  filter_stats: FilterStatsData;
  news_items: NewsItemData[];
  editorial_analysis?: EditorialAnalysisData;
}
