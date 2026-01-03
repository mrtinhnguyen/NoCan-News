/**
 * Google News RSS URL 상수
 * @see https://news.google.com/rss
 */
export const GOOGLE_RSS_URLS = {
  // Base Template for Custom Queries
  // Usage: Replace {KEYWORD} with URL-encoded query string
  SEARCH_BASE:
    'https://news.google.com/rss/search?q={KEYWORD}&hl=ko&gl=KR&ceid=KR:ko',

  // Fixed Topics (Topic IDs)
  // Business (Economy)
  SECTION_BUSINESS:
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko',

  // Science & Technology
  SECTION_TECH:
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko',

  // World (Global)
  SECTION_WORLD:
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko',
};

/**
 * Custom Query 키워드 (URL 인코딩됨)
 */
export const CUSTOM_QUERIES = {
  // 정책 및 사회 구조 뉴스 (사건사고 제외)
  POLICY: encodeURIComponent(
    '정책 OR 입법 OR 제도 OR 인구 OR 노동 OR 교육 -사고 -사망 -포토 -부고 when:1d',
  ),

  // 사설 - 보수 (조선일보, 중앙일보, 동아일보)
  EDITORIAL_CONSERVATIVE: encodeURIComponent(
    'site:chosun.com OR site:joongang.co.kr OR site:donga.com 사설 when:2d',
  ),

  // 사설 - 진보 (한겨레, 경향신문, 오마이뉴스)
  EDITORIAL_LIBERAL: encodeURIComponent(
    'site:hani.co.kr OR site:khan.co.kr OR site:ohmynews.com 사설 when:2d',
  ),
};

/**
 * 뉴스 카테고리
 */
export type NewsCategory = 'business' | 'tech' | 'policy' | 'world';

/**
 * 사설 정치 성향
 */
export type EditorialStance = 'conservative' | 'liberal';
