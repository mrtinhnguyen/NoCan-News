/**
 * Backfill Keywords Script
 *
 * This script extracts keywords from existing newsletters and updates
 * the all_keywords column.
 *
 * Usage:
 *   npx ts-node scripts/backfill-keywords.ts
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SECRET_KEY
 *   - GEMINI_API_KEY (for AI keyword extraction)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface NewsItem {
  original_title: string;
  refined_title: string;
  insight: {
    fact: string;
    context: string;
    implication: string;
  };
}

interface ContentData {
  news_items: NewsItem[];
}

interface Newsletter {
  id: string;
  send_date: string;
  content_data: ContentData;
  all_keywords: string[] | null;
}

async function extractKeywords(
  newsItems: NewsItem[],
  existingKeywords: string[],
): Promise<string[]> {
  if (newsItems.length === 0) return [];

  const newsContext = newsItems
    .map(
      (news, idx) =>
        `[${idx}] ${news.refined_title}\n- ${news.insight?.fact ?? '(Không có insight)'}`,
    )
    .join('\n\n');

  const existingKeywordsSection =
    existingKeywords.length > 0
      ? `
## ⚠️ Từ khóa hiện có (Quy tắc ưu tiên cao nhất)
Dưới đây là các từ khóa đã được sử dụng trong các bản tin trước.
**Nếu có tin tức cùng chủ đề, BẮT BUỘC phải sử dụng từ khóa hiện có.**
- Ngay cả khi cách viết, năm, hay từ ngữ khác nhau, nếu cùng chủ đề hãy dùng từ khóa hiện có.

Danh sách từ khóa hiện có:
${existingKeywords.map((k) => `- "${k}"`).join('\n')}
`
      : '';

  const prompt = `Trích xuất **từ khóa theo dõi vấn đề** từ danh sách tin tức.
${existingKeywordsSection}
## Tiêu chí trích xuất
1. **Ưu tiên Danh từ riêng:** Tên chính sách, tên luật, tên doanh nghiệp, tên nhân vật, tên công nghệ
2. **Vấn đề có thể theo dõi liên tục:** Loại bỏ các sự kiện một lần
3. **Dạng có thể tìm kiếm:** Từ khóa ngắn gọn và rõ ràng
4. **Tái sử dụng từ khóa hiện có:** Nếu có từ khóa hiện có cùng chủ đề, bắt buộc phải sử dụng nó

## Danh sách Tin tức
${newsContext}

## Định dạng Đầu ra (Chỉ xuất mảng JSON, tối đa 15 từ khóa)
["Từ khóa 1", "Từ khóa 2", "Từ khóa 3", ...]`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response');
      return [];
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[];
    return [...new Set(keywords.filter((k) => k.trim()))];
  } catch (error) {
    console.error('AI keyword extraction failed:', error);
    return [];
  }
}

async function backfillKeywords(): Promise<void> {
  console.log('Starting keyword backfill...\n');

  // Fetch all newsletters without keywords
  const { data: newsletters, error } = await supabase
    .from('newsletters')
    .select('id, send_date, content_data, all_keywords')
    .order('send_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch newsletters:', error.message);
    process.exit(1);
  }

  if (!newsletters || newsletters.length === 0) {
    console.log('No newsletters found');
    return;
  }

  // Filter newsletters that need keywords
  const needsBackfill = (newsletters as Newsletter[]).filter(
    (n) => !n.all_keywords || n.all_keywords.length === 0,
  );

  console.log(`Found ${newsletters.length} total newsletters`);
  console.log(`${needsBackfill.length} newsletters need keyword extraction\n`);

  let processed = 0;
  let failed = 0;

  // Collect existing keywords as we go (accumulate for consistency)
  const accumulatedKeywords = new Set<string>();

  for (const newsletter of needsBackfill) {
    try {
      console.log(
        `[${processed + 1}/${needsBackfill.length}] Processing ${newsletter.send_date}...`,
      );

      const contentData = newsletter.content_data as ContentData;
      if (!contentData?.news_items) {
        console.log(`  Skipping - no news items`);
        continue;
      }

      // Extract keywords using AI (pass accumulated keywords for consistency)
      const keywords = await extractKeywords(contentData.news_items, [
        ...accumulatedKeywords,
      ]);

      if (keywords.length === 0) {
        console.log(`  No keywords extracted`);
        failed++;
        continue;
      }

      // Update newsletter with keywords
      const { error: updateError } = await supabase
        .from('newsletters')
        .update({ all_keywords: keywords })
        .eq('id', newsletter.id);

      if (updateError) {
        console.error(`  Update failed: ${updateError.message}`);
        failed++;
        continue;
      }

      console.log(
        `  Extracted ${keywords.length} keywords: ${keywords.slice(0, 5).join(', ')}...`,
      );
      // Accumulate keywords for next iterations
      for (const k of keywords) {
        accumulatedKeywords.add(k);
      }
      processed++;

      // Rate limiting - wait 1 second between API calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  Error: ${error}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('Backfill completed!');
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${needsBackfill.length - processed - failed}`);
  console.log('========================================');
}

// Run the script
backfillKeywords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
