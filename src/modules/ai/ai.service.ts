import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevModeConfig } from '../../common/config/dev-mode.config';
import { NewsCategory } from '../../common/constants';
import {
  Editorial,
  EditorialSynthesis,
  FilterStats,
  InsightResult,
  NewsItem,
  ScrapedNews,
  SelectionResult,
} from '../../common/interfaces';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly devModeConfig: DevModeConfig,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey && this.devModeConfig.isAiEnabled) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
  }

  /**
   * 1단계: 카테고리별 뉴스 선별 + 독성 필터링
   * 각 카테고리에서 가장 중요한 3개 뉴스 선택
   */
  async selectNewsForCategory(
    newsItems: NewsItem[],
    category: NewsCategory,
  ): Promise<SelectionResult> {
    this.logger.log(
      `Selecting news for ${category} (${newsItems.length} items)...`,
    );

    if (newsItems.length === 0) {
      return {
        filterStats: {
          scanned: 0,
          blocked: { crime: 0, gossip: 0, politicalStrife: 0 },
        },
        selectedIndices: [],
      };
    }

    // DEV MODE: AI 스킵 - 처음 3개 자동 선택
    if (!this.devModeConfig.isAiEnabled) {
      const selectedCount = Math.min(3, newsItems.length);
      const selectedIndices = Array.from(
        { length: selectedCount },
        (_, i) => i,
      );

      this.logger.log(`[DEV] Skipping AI selection for ${category}`);
      this.logger.log(
        `[DEV] Auto-selecting first ${selectedCount} items: [${selectedIndices.join(', ')}]`,
      );

      if (this.devModeConfig.verboseLogging) {
        selectedIndices.forEach((idx) => {
          this.logger.log(`  [SELECTED] ${newsItems[idx]?.title}`);
        });
      }

      return {
        filterStats: {
          scanned: newsItems.length,
          blocked: { crime: 0, gossip: 0, politicalStrife: 0 },
        },
        selectedIndices,
      };
    }

    const categoryNames: Record<NewsCategory, string> = {
      business: '비즈니스/경제',
      tech: '기술/과학',
      policy: '정책/사회',
      world: '국제/세계',
    };

    const newsListText = newsItems
      .map(
        (item, idx) =>
          `[${idx}] 제목: ${item.title}\n    요약: ${item.snippet || '없음'}`,
      )
      .join('\n\n');

    const prompt = `당신은 뉴스 큐레이터입니다. 아래는 ${categoryNames[category]} 카테고리의 뉴스 목록입니다.

                    ## 작업
                    1. **독성 필터링**: 아래 기준에 해당하는 뉴스를 식별하세요.
                      - crime: 살인, 폭력, 성범죄, 사고사망 등 범죄/사건 뉴스
                      - gossip: 연예인 가십, 루머, 사생활 관련 뉴스
                      - politicalStrife: 정치적 비방, 당파 싸움, 감정적 정치 뉴스

                    2. **뉴스 선별**: 독성을 제외한 뉴스 중 가장 중요하고 유의미한 5개를 선택하세요.
                      - 사회적/경제적 영향이 큰 뉴스
                      - 구조적 변화나 트렌드를 보여주는 뉴스
                      - 독자에게 실질적 인사이트를 줄 수 있는 뉴스
                      - 만약 중요한 뉴스가 5개가 안된다면, 독성 필터링에 걸러진 것들 중에서 가장 중요한 뉴스

                    ## 뉴스 목록
                    ${newsListText}

                    ## 출력 형식 (JSON만 출력, 다른 텍스트 없이)
                    {
                      "filterStats": {
                        "scanned": ${newsItems.length},
                        "blocked": {
                          "crime": [범죄 뉴스 수],
                          "gossip": [가십 뉴스 수],
                          "politicalStrife": [정치비방 뉴스 수]
                        }
                      },
                      "selectedIndices": [선택된 뉴스의 인덱스 번호 5개]
                    }`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as SelectionResult;
      this.logger.log(
        `${category}: Selected ${parsed.selectedIndices.length} news, blocked ${
          parsed.filterStats.blocked.crime +
          parsed.filterStats.blocked.gossip +
          parsed.filterStats.blocked.politicalStrife
        }`,
      );

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to select news for ${category}`, error);
      return {
        filterStats: {
          scanned: newsItems.length,
          blocked: { crime: 0, gossip: 0, politicalStrife: 0 },
        },
        selectedIndices:
          newsItems.length > 0
            ? [0, 1, 2, 3, 4].slice(0, Math.min(5, newsItems.length))
            : [],
      };
    }
  }

  /**
   * 2단계: 헤드라인 중화 + 인사이트 생성
   * 선별된 뉴스에 대해 한 번에 처리
   */
  async generateInsights(scrapedNews: ScrapedNews[]): Promise<InsightResult[]> {
    this.logger.log(`Generating insights for ${scrapedNews.length} news...`);

    if (scrapedNews.length === 0) {
      return [];
    }

    // DEV MODE: AI 스킵 - 원본 제목 + 플레이스홀더 인사이트
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Skipping AI insights generation');
      this.logger.log('[DEV] Using original titles with placeholder insights');

      return scrapedNews.map((news: ScrapedNews) => {
        if (this.devModeConfig.verboseLogging) {
          this.logger.log(`  [DEV] ${news.title}`);
          this.logger.log(`        Content: ${news.content.slice(0, 100)}...`);
        }

        return {
          detoxedTitle: `[DEV] ${news.title}`,
          insight: {
            fact: `[DEV MODE] 본문 미리보기: ${news.content.slice(0, 150)}...`,
            context:
              '[DEV MODE] AI 분석이 비활성화되어 있습니다. DEV_AI_ENABLED=true로 설정하세요.',
            implication: '[DEV MODE] 실제 인사이트를 보려면 AI를 활성화하세요.',
          },
        };
      });
    }

    const newsListText = scrapedNews
      .map(
        (item: ScrapedNews, idx: number) =>
          `[${idx}] 카테고리: ${item.category}
제목: ${item.title}
본문:
${item.content.slice(0, 1500)}${item.content.length > 1500 ? '...(생략)' : ''}`,
      )
      .join('\n\n---\n\n');

    const prompt = `당신은 "NoCan News"의 AI 편집자입니다. 불안을 유발하는 자극적 뉴스를 차분하고 건조한 팩트로 변환합니다.

## 작업
아래 ${scrapedNews.length}개의 뉴스에 대해 각각:
1. **제목 중화 (detoxedTitle)**: 자극적/감정적 표현을 제거하고 건조한 팩트 중심으로 재작성
   - 예: "개미들 곡소리... 삼성전자 4만전자 가나?" → "삼성전자, 업황 둔화로 52주 신저가 기록"
2. **3줄 인사이트 생성**:
   - fact: 무슨 일이 있었는가? (객관적 사실)
   - context: 왜 일어났는가? (구조적 원인, 배경)
   - implication: 무엇을 의미하는가? (향후 전망, 시사점)

## 뉴스 목록
${newsListText}

## 출력 형식 (JSON 배열만 출력)
[
  {
    "detoxedTitle": "중화된 제목",
    "insight": {
      "fact": "객관적 사실 요약 (1-2문장)",
      "context": "구조적 원인/배경 (1-2문장)",
      "implication": "시사점/전망 (1-2문장)"
    }
  }
]`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as InsightResult[];
      this.logger.log(`Generated insights for ${parsed.length} news`);

      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate insights', error);
      return scrapedNews.map((news: ScrapedNews) => ({
        detoxedTitle: news.title,
        insight: {
          fact: news.snippet || '정보를 불러올 수 없습니다.',
          context: '추가 분석이 필요합니다.',
          implication: '향후 추이를 지켜볼 필요가 있습니다.',
        },
      }));
    }
  }

  /**
   * 보수/진보 사설 중 같은 주제 쌍 매칭
   * @returns 매칭된 인덱스 쌍 또는 null (매칭 실패 시)
   */
  async matchEditorials(
    conservative: Editorial[],
    liberal: Editorial[],
  ): Promise<{
    conservativeIdx: number;
    liberalIdx: number;
    topic: string;
  } | null> {
    this.logger.log(
      `Matching editorials: ${conservative.length} conservative, ${liberal.length} liberal`,
    );

    if (conservative.length === 0 || liberal.length === 0) {
      this.logger.warn('No editorials to match');
      return null;
    }

    // DEV MODE: AI 스킵 - 첫 번째 사설끼리 mock 매칭
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Using mock editorial matching (first pair)');

      if (this.devModeConfig.verboseLogging) {
        this.logger.log('[DEV] Conservative editorials:');
        conservative.slice(0, 3).forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
        if (conservative.length > 3) {
          this.logger.log(`  ... and ${conservative.length - 3} more`);
        }
        this.logger.log('[DEV] Liberal editorials:');
        liberal.slice(0, 3).forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
        if (liberal.length > 3) {
          this.logger.log(`  ... and ${liberal.length - 3} more`);
        }
      }

      // Mock 매칭: 첫 번째 사설끼리 매칭 (스크래핑 테스트용)
      const mockMatch = {
        conservativeIdx: 0,
        liberalIdx: 0,
        topic: '[DEV] Mock 매칭 - 사설 스크래핑 테스트',
      };
      this.logger.log(
        `[DEV] Mock matched: "${conservative[0].title}" vs "${liberal[0].title}"`,
      );
      return mockMatch;
    }

    const conservativeList = conservative
      .map((e, idx) => `[${idx}] ${e.title}`)
      .join('\n');

    const liberalList = liberal
      .map((e, idx) => `[${idx}] ${e.title}`)
      .join('\n');

    const prompt = `당신은 뉴스 분석가입니다. 아래 보수 성향 사설과 진보 성향 사설 목록에서 **같은 주제**를 다루는 쌍을 찾아주세요.

## 보수 성향 사설 (조선일보, 중앙일보)
${conservativeList}

## 진보 성향 사설 (한겨레, 경향신문)
${liberalList}

## 작업
1. 양측에서 동일한 이슈/주제를 다루는 사설 쌍이 있는지 확인하세요.
2. 같은 주제를 다루는 쌍이 있다면 인덱스와 주제를 반환하세요.
3. 같은 주제가 없다면 null을 반환하세요.

## 출력 형식 (JSON만 출력)
매칭 성공 시:
{
  "conservativeIdx": 0,
  "liberalIdx": 1,
  "topic": "공통 주제 (예: 의대 증원 정책)"
}

매칭 실패 시:
null`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // null 응답 체크
      if (responseText === 'null' || responseText.toLowerCase() === 'null') {
        this.logger.log('No matching editorial pair found');
        return null;
      }

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Failed to parse editorial matching response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        conservativeIdx: number;
        liberalIdx: number;
        topic: string;
      };

      // 인덱스 유효성 검사
      if (
        parsed.conservativeIdx < 0 ||
        parsed.conservativeIdx >= conservative.length ||
        parsed.liberalIdx < 0 ||
        parsed.liberalIdx >= liberal.length
      ) {
        this.logger.warn('Invalid editorial indices returned');
        return null;
      }

      this.logger.log(`Matched editorials on topic: ${parsed.topic}`);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to match editorials', error);
      return null;
    }
  }

  /**
   * 사설 통합 분석 (정반합)
   */
  async synthesizeEditorials(
    conservativeText: string,
    liberalText: string,
    topic: string,
  ): Promise<EditorialSynthesis> {
    this.logger.log(`Synthesizing editorials on topic: ${topic}`);

    // DEV MODE: AI 스킵 - mock 통합 분석 반환
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Using mock editorial synthesis');

      if (this.devModeConfig.verboseLogging) {
        this.logger.log(
          `[DEV] Conservative text preview: ${conservativeText.slice(0, 200)}...`,
        );
        this.logger.log(
          `[DEV] Liberal text preview: ${liberalText.slice(0, 200)}...`,
        );
      }

      return {
        topic: `[DEV] ${topic}`,
        conflict:
          '[DEV MODE] AI 분석이 비활성화되어 있습니다. 실제 쟁점 분석을 보려면 DEV_AI_ENABLED=true로 설정하세요.',
        argumentA: `[DEV] 보수 사설 본문 길이: ${conservativeText.length}자`,
        argumentB: `[DEV] 진보 사설 본문 길이: ${liberalText.length}자`,
        synthesis:
          '[DEV MODE] 사설 스크래핑 성공 여부를 확인하기 위한 테스트 모드입니다.',
      };
    }

    const prompt = `당신은 중립적인 정치 분석가입니다. 같은 주제에 대한 보수와 진보 사설을 분석합니다.

## 원칙
- 절대 어느 한쪽 편을 들지 않습니다
- 감정적 언어를 배제하고 논리적 쟁점만 추출합니다
- 양측의 주장을 공정하게 요약합니다

## 보수 측 사설
${conservativeText.slice(0, 2000)}

## 진보 측 사설
${liberalText.slice(0, 2000)}

## 출력 형식 (JSON만 출력)
{
  "topic": "핵심 주제 (한 문장)",
  "conflict": "핵심 쟁점 - 무엇 때문에 의견이 갈리는가? (2-3문장)",
  "argumentA": "보수 측 핵심 논리 요약 (2-3문장)",
  "argumentB": "진보 측 핵심 논리 요약 (2-3문장)",
  "synthesis": "이 갈등이 시사하는 구조적/시대적 의미 (2-3문장)"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      return JSON.parse(jsonMatch[0]) as EditorialSynthesis;
    } catch (error) {
      this.logger.error('Failed to synthesize editorials', error);
      return {
        topic,
        conflict: '분석을 수행할 수 없습니다.',
        argumentA: '보수 측 의견 요약 불가',
        argumentB: '진보 측 의견 요약 불가',
        synthesis: '추가 분석이 필요합니다.',
      };
    }
  }

  /**
   * 방어 로그 메시지 생성
   */
  generateProtectionLog(stats: FilterStats): string {
    const { totalScanned, blocked } = stats;

    return (
      `오늘 AI가 총 ${totalScanned.toLocaleString()}건을 스캔하여 ` +
      `범죄 ${blocked.crime}건, 가십 ${blocked.gossip}건, ` +
      `정치비방 ${blocked.politicalStrife}건을 차단했습니다.`
    );
  }

  /**
   * 통합 필터 통계 계산
   */
  aggregateFilterStats(results: SelectionResult[]): FilterStats {
    return results.reduce<FilterStats>(
      (acc: FilterStats, result: SelectionResult) => ({
        totalScanned:
          acc.totalScanned + (Number(result.filterStats?.scanned) || 0),
        blocked: {
          crime:
            acc.blocked.crime +
            (Number(result.filterStats?.blocked?.crime) || 0),
          gossip:
            acc.blocked.gossip +
            (Number(result.filterStats?.blocked?.gossip) || 0),
          politicalStrife:
            acc.blocked.politicalStrife +
            (Number(result.filterStats?.blocked?.politicalStrife) || 0),
        },
      }),
      {
        totalScanned: 0,
        blocked: { crime: 0, gossip: 0, politicalStrife: 0 },
      },
    );
  }
}
