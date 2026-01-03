import { ScrapedNews } from '../../src/common/interfaces';

/**
 * 스크래핑 결과 생성기
 */
export function createScrapingResults(
  newsItems: any[],
  successRate: number, // 0.0 ~ 1.0
): ScrapedNews[] {
  const successCount = Math.floor(newsItems.length * successRate);

  return newsItems.slice(0, successCount).map((item) => ({
    ...item,
    content: `Mock article content for ${item.title}. This is a simulated full article text with multiple paragraphs.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. This is a longer mock content to simulate real article text.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
  }));
}

/**
 * 사설 본문 Mock
 */
export const mockEditorialContent = {
  conservative: `
[보수 사설 전문]

반도체 산업은 우리 경제의 핵심이다.
정부는 신속한 지원법 처리로 기업 경쟁력을 뒷받침해야 한다.
규제 완화와 세제 혜택이 필요하다.

기업이 글로벌 경쟁에서 승리하려면 정부의 적극적인 지원이 필수다.
  `.trim(),

  liberal: `
[진보 사설 전문]

반도체 산업 육성은 중요하지만 공정성도 중요하다.
대기업뿐 아니라 중소기업과 노동자도 보호해야 한다.
지속 가능한 성장 전략이 필요하다.

산업 육성과 함께 사회적 책임도 고려해야 한다.
  `.trim(),
};
