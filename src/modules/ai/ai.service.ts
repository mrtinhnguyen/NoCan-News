import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
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
import { withRetry } from '../../common/utils/retry.util';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly devModeConfig: DevModeConfig) {
    const apiKey = this.devModeConfig.getGeminiApiKey();
    if (!apiKey && this.devModeConfig.isAiEnabled) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
  }

  /**
   * Bước 1: Chọn lọc tin tức theo danh mục + Lọc độc hại
   * Chọn 3 tin tức quan trọng nhất từ mỗi danh mục
   */
  async selectNewsForCategory(
    newsItems: NewsItem[],
    category: NewsCategory,
  ): Promise<SelectionResult> {
    this.logger.log(
      `Đang chọn lọc tin tức cho ${category} (${newsItems.length} tin)...`,
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

    // DEV MODE: Bỏ qua AI - Tự động chọn 3 tin đầu tiên
    if (!this.devModeConfig.isAiEnabled) {
      const selectedCount = Math.min(3, newsItems.length);
      const selectedIndices = Array.from(
        { length: selectedCount },
        (_, i) => i,
      );

      this.logger.log(`[DEV] Bỏ qua AI chọn lọc cho ${category}`);
      this.logger.log(
        `[DEV] Tự động chọn ${selectedCount} tin đầu tiên: [${selectedIndices.join(', ')}]`,
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
      business: 'Kinh doanh/Kinh tế',
      tech: 'Công nghệ/Khoa học',
      society: 'Xã hội',
      world: 'Quốc tế/Thế giới',
    };

    // Chỉ gửi 20 tin đầu cho AI (RSS Google News đã sắp xếp theo độ quan trọng)
    const limitedItems = newsItems.slice(0, 20);

    const newsListText = limitedItems
      .map(
        (item, idx) =>
          `[${idx}] Tiêu đề: ${item.title}\n    Tóm tắt: ${item.snippet || 'Không có'}`,
      )
      .join('\n\n');

    const prompt = `Bạn là một người tuyển chọn tin tức, chuyên đọc ra **'Bối cảnh Vĩ mô (Macro Context)'**.
Danh sách dưới đây là các tin tức thuộc danh mục **${categoryNames[category]}**, được sắp xếp theo mức độ quan trọng.

## Mục tiêu Cốt lõi
Không chỉ đơn thuần là "lọc bỏ tin xấu".
Mục tiêu là tìm ra **"những tin tức mang tính cấu trúc thay đổi Quy tắc (Rule) hoặc Môi trường (Environment) sống của chúng ta"**.

## Chỉ dẫn Công việc
Xem xét từ **đầu danh sách (số 0)** trở xuống, chỉ chọn tối đa 3 tin tức thỏa mãn **TẤT CẢ** các điều kiện sau:
1. Không vi phạm [Tiêu chí Loại bỏ Tuyệt đối]
2. Thỏa mãn ít nhất một trong các [Tiêu chí Lựa chọn Bắt buộc]

**Quan trọng:** Nếu tin tức không vi phạm tiêu chí loại bỏ nhưng không thỏa mãn [Tiêu chí Lựa chọn Bắt buộc], hãy **KHÔNG CHỌN.**
Nếu tin tức ở đầu danh sách không có giá trị, hãy mạnh dạn bỏ qua.

---

## 1. Tiêu chí Loại bỏ Tuyệt đối (Loại ngay lập tức)

A. **Nhiễu (Noise):**
  - **Sự vụ đơn thuần:** Hỏa hoạn, tai nạn giao thông, giết người, ngập lụt, v.v. (chỉ phản ánh hiện tượng mà không phân tích nguyên nhân cấu trúc)
  - **Tranh cãi chính trị/Điều tra:** Khám xét, bắt giam, tranh cãi, chỉ trích, triệu tập kiểm sát, v.v. (rủi ro pháp lý cá nhân của chính trị gia hoặc khẩu chiến)
  - **Thị trường/Thời tiết đơn thuần:** Thời tiết hôm nay, biến động tỷ giá/chứng khoán không có gì đặc biệt
  - **Chuyện phiếm/Giải trí:** Đời tư nghệ sĩ, kết quả thi đấu thể thao
  - *(Tuy nhiên, Chiến tranh, Lãnh đạo quốc gia bị bắt/lưu vong, Khủng bố v.v. là **các sự kiện cấu trúc ảnh hưởng đến tình hình quốc tế** thì là ngoại lệ)*

B. **Thông tin ít giá trị (Low Value):**
  - **Quảng cáo đơn thuần (PR):** Ký kết MOU, công bố tầm nhìn, tuyển dụng, giải thưởng, nhân sự (bổ nhiệm) v.v. không có thay đổi thực chất
  - **Phát ngôn/Phỏng vấn đơn thuần:** "Đã nói rằng...", "Đã khẳng định...", "Đã cho biết..." v.v. chỉ truyền tải ý kiến ai đó mà **không có quyết định chính sách cụ thể hay thay đổi số liệu**
  - **Mẹo đầu tư/Tài chính:** "Cổ phiếu nào đang lên", "Lựa chọn của cao thủ", "Mua ngay kẻo lỡ" v.v. các bài viết khuyến nghị đầu tư
  - **Tin tức cục bộ:** Sự kiện nhỏ ở địa phương, thông báo hành chính đơn thuần
  - **Bài viết chung chung/Góc nhìn:** Bài phân tích hiện tượng mà không gắn với sự kiện cụ thể

C. **Sai danh mục:**
  - Loại bỏ các tin tức **không phù hợp với danh mục hiện tại (${categoryNames[category]})**.
${
  category === 'society'
    ? `
D. **Tiêu chí đặc biệt cho danh mục Xã hội:**
  - 'Xã hội' không phải là các vụ án, tai nạn mà phải đề cập đến **"Vấn đề của Hệ thống"**
  - Loại bỏ hoàn toàn các tin báo cáo tội phạm đơn thuần, kết quả xét xử, dự báo thời tiết, vận động tranh cử, thể thao/giải trí
`
    : ''
}
---

## 2. Tiêu chí Lựa chọn Bắt buộc (Phải thỏa mãn ít nhất một)

Ngay cả khi đã tránh được tiêu chí loại bỏ, **chỉ chọn nếu tin tức chứa ít nhất một trong các giá trị sau**:

- **Thay đổi Hệ thống:** Thông qua luật, thay đổi chế độ, xác định/đóng băng chính sách (VD: "Chốt phương án cải cách bảo hiểm xã hội", "Lãi suất cơ bản giữ nguyên N lần liên tiếp")
- **Vượt ngưỡng (Breaking Point):** Các chỉ số ám chỉ thay đổi cấu trúc như **"Cao/Thấp nhất lịch sử", "Lần đầu tiên trong lịch sử", "Sau N năm", "N lần liên tiếp"** (VD: "Nợ vay ký quỹ Samsung Electronics cao kỷ lục", "Tỷ sinh tụt xuống mức 0.6")
- **Thay đổi Cục diện Ngành/Công nghệ:** M&A thay đổi cấu trúc thị trường, thương mại hóa công nghệ đột phá, đầu tư quy mô lớn (nghìn tỷ)
- **Biến động Trật tự Quốc tế:** Chiến tranh bùng nổ/kết thúc, thay đổi biên giới, hành động cụ thể trong cạnh tranh bá quyền, hiệp ước giữa các quốc gia

**Tự vấn:** "Tin tức này có còn quan trọng sau 1 năm nữa không?" → Nếu không, hãy loại bỏ.

---

## Danh sách Tin tức
${newsListText}

## Định dạng Đầu ra (Chỉ xuất JSON)
{
  "filterStats": {
    "scanned": ${limitedItems.length},
    "blocked": {
      "crime": [Số lượng tin tội phạm/tai nạn bị chặn],
      "gossip": [Số lượng tin chuyện phiếm/PR/phi tin tức bị chặn],
      "politicalStrife": [Số lượng tin tranh cãi chính trị bị chặn]
    }
  },
  "selectedIndices": [Danh sách index của tin được chọn (tối đa 3, chỉ những tin thỏa mãn tiêu chí bắt buộc)]
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
            ? [0, 1, 2].slice(0, Math.min(3, newsItems.length))
            : [],
      };
    }
  }

  /**
   * Bước 2: Trung hòa tiêu đề + Tạo Insight
   * Xử lý một lần cho tất cả tin tức đã chọn
   */
  async generateInsights(scrapedNews: ScrapedNews[]): Promise<InsightResult[]> {
    this.logger.log(`Generating insights for ${scrapedNews.length} news...`);

    if (scrapedNews.length === 0) {
      return [];
    }

    // DEV MODE: Bỏ qua AI - Tiêu đề gốc + Insight giả lập
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Skipping AI insights generation');
      this.logger.log('[DEV] Using original titles with placeholder insights');

      return scrapedNews.map((news: ScrapedNews, idx: number) => {
        if (this.devModeConfig.verboseLogging) {
          this.logger.log(`  [DEV] ${news.title}`);
          this.logger.log(`        Content: ${news.content.slice(0, 100)}...`);
        }

        return {
          index: idx,
          detoxedTitle: `[DEV] ${news.title}`,
          insight: {
            fact: `[DEV MODE] Xem trước nội dung: ${news.content.slice(0, 150)}...`,
            context:
              '[DEV MODE] AI phân tích đang bị tắt. Hãy đặt DEV_AI_ENABLED=true để bật.',
            implication: '[DEV MODE] Hãy bật AI để xem insight thực tế.',
          },
        };
      });
    }

    const newsListText = scrapedNews
      .map(
        (item: ScrapedNews, idx: number) =>
          `[${idx}] Danh mục: ${item.category}
Tiêu đề: ${item.title}
Nội dung:
${item.content.slice(0, 1500)}${item.content.length > 1500 ? '...(lược bỏ)' : ''}`,
      )
      .join('\n\n---\n\n');

    const prompt = `Bạn là biên tập viên AI của "NoCan News". Bạn chuyển đổi những tin tức giật gân, gây lo lắng thành những sự thật khô khan và bình tĩnh.

                    ## Nguyên tắc làm việc
                    Tạo dữ liệu JSON cho ${scrapedNews.length} tin tức dưới đây.

                    1. **Trung hòa Tiêu đề (detoxedTitle)**: 
                      - Loại bỏ tính từ cảm xúc, mô tả gây sốc, clickbait.
                      - **Quan trọng:** Với các chủ đề như chiến tranh, bắt giữ, tai nạn, càng phải giữ giọng văn **khô khan và hành chính**. (VD: "Caracas chìm trong biển lửa" -> "Biểu tình quy mô lớn và xung đột vũ trang xảy ra")

                    2. **Tạo Insight 3 dòng**:
                      - fact: Chuyện gì đã xảy ra? (Mô tả khô khan dựa trên 5W1H)
                      - context: Tại sao nó xảy ra? (Bối cảnh lịch sử, quan hệ nhân quả, lý do địa chính trị)
                      - implication: Nó có ý nghĩa gì? (Tác động thị trường, thay đổi tình hình quốc tế, triển vọng tương lai)
                      - **Lưu ý:** Với tin chiến tranh/xung đột, thay vì mô tả hiện trường như 'tiếng la hét', 'vết máu', hãy trích xuất **bối cảnh cấu trúc như 'giá dầu', 'quan hệ ngoại giao', 'ổn định chính quyền'**.

                    ## Danh sách Tin tức
                    ${newsListText}

                    ## Định dạng Đầu ra (Chỉ xuất mảng JSON)
                    **Quan trọng:** Bắt buộc phải bao gồm số thứ tự tin tức ([0], [1], [2]...) vào trường "index".
                    [
                      {
                        "index": 0,
                        "detoxedTitle": "Tiêu đề đã được trung hòa",
                        "insight": {
                          "fact": "Tóm tắt sự thật khách quan (1-2 câu)",
                          "context": "Nguyên nhân/Bối cảnh cấu trúc (1-2 câu)",
                          "implication": "Ý nghĩa/Triển vọng (1-2 câu)"
                        }
                      }
                    ]`;

    try {
      const result = await withRetry(() => this.model.generateContent(prompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `[Retry ${attempt}/3] generateInsights failed, retrying... Error: ${error.message}`,
          );
        },
      });
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as InsightResult[];
      this.logger.log(`Generated insights for ${parsed.length} news`);

      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate insights after 3 retries', error);
      this.logger.warn(
        `⚠️ FALLBACK APPLIED: Using default values for ${scrapedNews.length} news items`,
      );
      return scrapedNews.map((news: ScrapedNews, idx: number) => ({
        index: idx,
        detoxedTitle: news.title,
        insight: {
          fact: '[AI Phân tích thất bại] Cần kiểm tra tin gốc',
          context: '[AI Phân tích thất bại] Cần kiểm tra tin gốc',
          implication: '[AI Phân tích thất bại] Cần kiểm tra tin gốc',
        },
        isFallback: true,
      }));
    }
  }

  /**
   * Khớp cặp bài xã luận cùng chủ đề giữa Quan điểm Bảo thủ và Tự do
   * @returns Cặp index đã khớp hoặc null (nếu thất bại)
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
      `Đang khớp xã luận: ${conservative.length} bảo thủ, ${liberal.length} tự do`,
    );

    if (conservative.length === 0 || liberal.length === 0) {
      this.logger.warn('Không có xã luận để khớp');
      return null;
    }

    // DEV MODE: Bỏ qua AI - Mock khớp cặp đầu tiên
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Sử dụng mock khớp xã luận (cặp đầu tiên)');

      if (this.devModeConfig.verboseLogging) {
        this.logger.log('[DEV] Xã luận Bảo thủ:');
        conservative.slice(0, 3).forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
        if (conservative.length > 3) {
          this.logger.log(`  ... và ${conservative.length - 3} bài khác`);
        }
        this.logger.log('[DEV] Xã luận Tự do:');
        liberal.slice(0, 3).forEach((e, i) => {
          this.logger.log(`  [${i}] ${e.title}`);
          this.logger.log(`      Link: ${e.link}`);
        });
        if (liberal.length > 3) {
          this.logger.log(`  ... và ${liberal.length - 3} bài khác`);
        }
      }

      // Mock khớp: Khớp cặp đầu tiên (để test cào dữ liệu)
      const mockMatch = {
        conservativeIdx: 0,
        liberalIdx: 0,
        topic: '[DEV] Mock khớp - Test cào xã luận',
      };
      this.logger.log(
        `[DEV] Đã khớp giả lập: "${conservative[0].title}" vs "${liberal[0].title}"`,
      );
      return mockMatch;
    }

    const conservativeList = conservative
      .map((e, idx) => `[${idx}] ${e.title}`)
      .join('\n');

    const liberalList = liberal
      .map((e, idx) => `[${idx}] ${e.title}`)
      .join('\n');

    const prompt = `Bạn là một nhà phân tích tin tức. Hãy tìm các cặp bài xã luận cùng chủ đề từ danh sách xã luận Quan điểm Bảo thủ và Quan điểm Tự do dưới đây.

## Xã luận Quan điểm Bảo thủ (Chosun, JoongAng)
${conservativeList}

## Xã luận Quan điểm Tự do (Hankyoreh, Kyunghyang)
${liberalList}

## Nhiệm vụ
1. Kiểm tra xem có cặp bài nào từ hai phía thảo luận cùng một vấn đề/chủ đề không.
2. Nếu có, hãy trả về index và chủ đề chung.
3. Nếu không có chủ đề chung, trả về null.

## Định dạng Đầu ra (Chỉ xuất JSON)
Nếu tìm thấy cặp bài:
{
  "conservativeIdx": 0,
  "liberalIdx": 1,
  "topic": "Chủ đề chung (VD: Chính sách tăng chỉ tiêu tuyển sinh y khoa)"
}

Nếu không tìm thấy:
null`;

    try {
      const result = await withRetry(() => this.model.generateContent(prompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `[Retry ${attempt}/3] matchEditorials failed, retrying... Error: ${error.message}`,
          );
        },
      });
      const responseText = result.response.text().trim();

      // Kiểm tra phản hồi null
      if (responseText === 'null' || responseText.toLowerCase() === 'null') {
        this.logger.log('Không tìm thấy cặp xã luận phù hợp');
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

      // Kiểm tra tính hợp lệ của index
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
      this.logger.error('Failed to match editorials after 3 retries', error);
      return null;
    }
  }

  /**
   * Tổng hợp phân tích xã luận (Chính - Phản - Hợp)
   */
  async synthesizeEditorials(
    conservativeText: string,
    liberalText: string,
    topic: string,
  ): Promise<EditorialSynthesis | null> {
    this.logger.log(`Synthesizing editorials on topic: ${topic}`);

    // DEV MODE: AI Skip - Trả về mock tổng hợp
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
          '[DEV MODE] AI phân tích đang tắt. Để xem phân tích thực tế, hãy đặt DEV_AI_ENABLED=true.',
        argumentA: `[DEV] Độ dài xã luận Bảo thủ: ${conservativeText.length} ký tự`,
        argumentB: `[DEV] Độ dài xã luận Tự do: ${liberalText.length} ký tự`,
        synthesis:
          '[DEV MODE] Chế độ kiểm tra để xác nhận việc thu thập dữ liệu xã luận thành công.',
      };
    }

    const prompt = `Bạn là một nhà phân tích chính trị trung lập. Bạn sẽ phân tích các bài xã luận từ quan điểm Bảo thủ và Tự do về cùng một chủ đề.

## Nguyên tắc
- Tuyệt đối không thiên vị bên nào
- Loại bỏ ngôn ngữ cảm xúc, chỉ trích xuất các luận điểm logic
- Tóm tắt công bằng lập luận của cả hai bên

## Xã luận Quan điểm Bảo thủ
${conservativeText.slice(0, 2000)}

## Xã luận Quan điểm Tự do
${liberalText.slice(0, 2000)}

## Định dạng Đầu ra (Chỉ xuất JSON)
{
  "topic": "Chủ đề chính (1 câu)",
  "conflict": "Điểm tranh luận cốt lõi - Tại sao ý kiến lại khác nhau? (2-3 câu)",
  "argumentA": "Tóm tắt luận điểm cốt lõi của bên Bảo thủ (2-3 câu)",
  "argumentB": "Tóm tắt luận điểm cốt lõi của bên Tự do (2-3 câu)",
  "synthesis": "Ý nghĩa cấu trúc/thời đại mà sự xung đột này gợi ra (2-3 câu)"
}`;

    try {
      const result = await withRetry(() => this.model.generateContent(prompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `[Retry ${attempt}/3] synthesizeEditorials failed, retrying... Error: ${error.message}`,
          );
        },
      });
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      return JSON.parse(jsonMatch[0]) as EditorialSynthesis;
    } catch (error) {
      this.logger.error(
        'Failed to synthesize editorials after 3 retries',
        error,
      );
      return null;
    }
  }

  /**
   * Tạo thông báo log bảo vệ
   */
  generateProtectionLog(stats: FilterStats): string {
    const { totalScanned, blocked } = stats;

    return (
      `Hôm nay AI đã quét tổng cộng ${totalScanned.toLocaleString()} tin, chặn ` +
      `tội phạm ${blocked.crime} tin, chuyện phiếm ${blocked.gossip} tin, ` +
      `tranh cãi chính trị ${blocked.politicalStrife} tin.`
    );
  }

  /**
   * Trích xuất từ khóa theo dõi vấn đề từ danh sách tin tức
   * @param newsItems - Danh sách tin tức đã tạo insight
   * @returns perArticle: Mảng từ khóa theo bài báo, all: Tất cả từ khóa đã loại bỏ trùng lặp
   */
  async extractKeywords(
    newsItems: Array<{
      title: string;
      insight?: { fact: string; context: string; implication: string };
    }>,
    existingKeywords: string[] = [],
  ): Promise<{ perArticle: string[][]; all: string[] }> {
    this.logger.log(
      `Extracting keywords from ${newsItems.length} news items (${existingKeywords.length} existing keywords as reference)...`,
    );

    const emptyResult = {
      perArticle: newsItems.map(() => []),
      all: [],
    };

    if (newsItems.length === 0) {
      return emptyResult;
    }

    // DEV MODE: AI Skip - Trả về kết quả rỗng
    if (!this.devModeConfig.isAiEnabled) {
      this.logger.log('[DEV] Skipping AI keyword extraction');
      return emptyResult;
    }

    const newsContext = newsItems
      .map(
        (news, idx) =>
          `[${idx}] ${news.title}\n- ${news.insight?.fact ?? '(Không có insight)'}`,
      )
      .join('\n\n');

    const existingKeywordsSection =
      existingKeywords.length > 0
        ? `
## ⚠️ Từ khóa hiện có (Quy tắc ưu tiên cao nhất)
Dưới đây là các từ khóa đã được sử dụng trong các bản tin trước.
**Nếu có tin tức cùng chủ đề, BẮT BUỘC phải sử dụng từ khóa hiện có.**
- "tăng chỉ tiêu y khoa" (X) → "tăng chỉ tiêu trường y" (O, từ khóa hiện có)
- "tuyển sinh y khoa 2025" (X) → "tăng chỉ tiêu trường y" (O, từ khóa hiện có)
- Ngay cả khi cách viết, năm, hay từ ngữ khác nhau, nếu cùng chủ đề hãy dùng từ khóa hiện có.

Danh sách từ khóa hiện có:
${existingKeywords.map((k) => `- "${k}"`).join('\n')}
`
        : '';

    const prompt = `Trích xuất **từ khóa theo dõi vấn đề** từ danh sách tin tức cho từng bài báo.
${existingKeywordsSection}
## Tiêu chí trích xuất
1. **Ưu tiên Danh từ riêng:** Tên chính sách, tên luật, tên doanh nghiệp, tên nhân vật, tên công nghệ (VD: "Cải cách tiền lương", "Bán dẫn HBM", "Tesla")
2. **Vấn đề có thể theo dõi liên tục:** Loại bỏ các sự kiện một lần (VD: "Hỏa hoạn" X, "Biến đổi khí hậu" O)
3. **Dạng có thể tìm kiếm:** Từ khóa ngắn gọn và rõ ràng (VD: "Cải cách bảo hiểm xã hội", "Tăng lãi suất")
4. **Tái sử dụng từ khóa hiện có:** Nếu có từ khóa hiện có cùng chủ đề, bắt buộc phải sử dụng nó.
5. **Tối đa 2 từ khóa mỗi bài:** Chỉ chọn 1-2 từ khóa cốt lõi nhất.

## Danh sách Tin tức
${newsContext}

## Định dạng Đầu ra (Chỉ xuất JSON, không có văn bản khác)
{
  "perArticle": [
    ["Từ khóa A", "Từ khóa B"],
    ["Từ khóa C"],
    ...
  ],
  "all": ["Từ khóa A", "Từ khóa B", "Từ khóa C", ...]
}

- perArticle: Mảng từ khóa tương ứng với từng bài báo ([0], [1], ...). Tối đa 2 từ khóa mỗi bài.
- all: Mảng tất cả các từ khóa trong perArticle đã được loại bỏ trùng lặp.`;

    try {
      const result = await withRetry(() => this.model.generateContent(prompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `[Retry ${attempt}/3] extractKeywords failed, retrying... Error: ${error.message}`,
          );
        },
      });
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        perArticle: string[][];
        all: string[];
      };

      // Nếu độ dài perArticle ngắn hơn newsItems, điền thêm mảng rỗng
      while (parsed.perArticle.length < newsItems.length) {
        parsed.perArticle.push([]);
      }

      // Loại bỏ trùng lặp trong all và loại bỏ chuỗi rỗng
      const uniqueAll = [...new Set(parsed.all.filter((k) => k.trim()))];

      this.logger.log(
        `Extracted ${uniqueAll.length} keywords (${newsItems.length} articles mapped): ${uniqueAll.slice(0, 5).join(', ')}...`,
      );
      return { perArticle: parsed.perArticle, all: uniqueAll };
    } catch (error) {
      this.logger.error('Failed to extract keywords after 3 retries', error);
      return emptyResult;
    }
  }

  /**
   * Tính toán thống kê bộ lọc tổng hợp
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
