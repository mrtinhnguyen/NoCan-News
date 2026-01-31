/**
 * Google News RSS URL Constants
 * @see https://news.google.com/rss
 */
export const GOOGLE_RSS_URLS = {
  // Base Template for Custom Queries
  // Usage: Replace {KEYWORD} with URL-encoded query string
  SEARCH_BASE:
    'https://news.google.com/rss/search?q={KEYWORD}&hl=vi&gl=VN&ceid=VN:vi',

  // Fixed Topics (Topic IDs)
  // Business (Economy)
  SECTION_BUSINESS:
    'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=vi&gl=VN&ceid=VN:vi',

  // Science & Technology (Global/English)
  SECTION_TECH:
    'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',

  // World (Global/English)
  SECTION_WORLD:
    'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en',

  // Vietnam (Nation/Việt Nam)
  SECTION_VIETNAM:
    'https://news.google.com/rss/headlines/section/topic/NATION?hl=vi&gl=VN&ceid=VN:vi',

  // Artificial Intelligence (AI) (Global/English)
  SECTION_AI:
    'https://news.google.com/rss/topics/CAAqIAgKIhpDQkFTRFFvSEwyMHZNRzFyZWhJQ1pXNG9BQVAB?hl=en-US&gl=US&ceid=US:en',

  // Crypto (Global/English)
  SECTION_CRYPTO:
    'https://news.google.com/rss/topics/CAAqJAgKIh5DQkFTRUFvS0wyMHZNSFp3YWpSZlloSUNaVzRvQUFQAQ?hl=en-US&gl=US&ceid=US:en',
};

/**
 * Custom Query Keywords (URL encoded)
 */
export const CUSTOM_QUERIES = {
  // Xã luận - Nhóm 1 (VnExpress, Dân Trí)
  EDITORIAL_CONSERVATIVE: encodeURIComponent(
    'site:vnexpress.net OR site:dantri.com.vn "Góc nhìn" when:2d',
  ),

  // Xã luận - Nhóm 2 (Tuổi Trẻ, Thanh Niên)
  EDITORIAL_LIBERAL: encodeURIComponent(
    'site:tuoitre.vn OR site:thanhnien.vn "Tiêu điểm" OR "Thời sự" when:2d',
  ),
};

/**
 * News Categories
 */
export type NewsCategory =
  | 'business'
  | 'tech'
  | 'society'
  | 'world'
  | 'ai'
  | 'crypto';

/**
 * Editorial Stance
 */
export type EditorialStance = 'conservative' | 'liberal';
