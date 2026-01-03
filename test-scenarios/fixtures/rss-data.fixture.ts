import { Editorial, NewsItem } from '../../src/common/interfaces';

/**
 * RSS 수집 결과 Mock 데이터
 */
export const mockRssData = {
  // 정상 케이스: 각 카테고리 충분한 뉴스
  success: {
    business: Array(20)
      .fill(null)
      .map((_, i) => createMockNews('business', i)),
    tech: Array(20)
      .fill(null)
      .map((_, i) => createMockNews('tech', i)),
    policy: Array(20)
      .fill(null)
      .map((_, i) => createMockNews('policy', i)),
    world: Array(20)
      .fill(null)
      .map((_, i) => createMockNews('world', i)),
  },

  // 부족 케이스: 일부 카테고리 뉴스 부족
  insufficient: {
    business: Array(5)
      .fill(null)
      .map((_, i) => createMockNews('business', i)),
    tech: Array(3)
      .fill(null)
      .map((_, i) => createMockNews('tech', i)),
    policy: Array(2)
      .fill(null)
      .map((_, i) => createMockNews('policy', i)),
    world: Array(4)
      .fill(null)
      .map((_, i) => createMockNews('world', i)),
  },
};

/**
 * 사설 Mock 데이터
 */
export const mockEditorials = {
  conservative: [
    {
      title: '[사설] 반도체 지원법 조속 처리해야',
      link: 'https://example.com/conservative/1',
      pubDate: new Date().toISOString(),
      stance: 'conservative' as const,
    },
    {
      title: '[사설] 경제 활성화를 위한 규제 완화 시급',
      link: 'https://example.com/conservative/2',
      pubDate: new Date().toISOString(),
      stance: 'conservative' as const,
    },
  ] as Editorial[],

  liberal: [
    {
      title: '[사설] 반도체 산업 육성, 정부 역할 중요',
      link: 'https://example.com/liberal/1',
      pubDate: new Date().toISOString(),
      stance: 'liberal' as const,
    },
    {
      title: '[사설] 공정한 경제 성장 전략 필요',
      link: 'https://example.com/liberal/2',
      pubDate: new Date().toISOString(),
      stance: 'liberal' as const,
    },
  ] as Editorial[],
};

function createMockNews(category: string, index: number): NewsItem {
  return {
    title: `[${category.toUpperCase()}] Mock News ${index + 1}`,
    link: `https://example.com/${category}/${index}`,
    pubDate: new Date().toISOString(),
    category: category as any,
  };
}
