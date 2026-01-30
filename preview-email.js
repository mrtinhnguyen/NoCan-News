const fs = require('fs');

// Mock data
const date = '2025-12-27';
const mockUnsubscribeUrl = 'https://nocan-news.vercel.app/unsubscribe?id=123';
const mockArchiveUrl = 'https://nocan-news.vercel.app/archive';
const protectionLog =
  'Hôm nay AI đã quét tổng cộng 1,247 tin, chặn 45 tin tội phạm, 89 tin chuyện phiếm, 123 tin tranh cãi chính trị.';

const mockNews = [
  {
    category: 'business',
    original: {
      title:
        'Khủng hoảng tỷ giá 1500 won, đồng đô la cạn kiệt nhưng chính phủ vẫn bơm tiền... Nguy cơ tăng trưởng thấp kéo dài',
    },
    rewrittenTitle: 'Tỷ giá Won/USD ghi nhận mức 1480 won, ảnh hưởng đến giá nhập khẩu tăng',
    insight: {
      fact: 'Tỷ giá Won/USD ghi nhận mức 1483.6 won vào tháng 12 năm 2025, cao nhất trong 8 tháng, khiến chỉ số giá nhập khẩu bao gồm nguyên liệu thô và giá tiêu dùng tăng lên.',
      context:
        'Tình trạng cung tiền Won trong nước nhiều nhưng dòng vốn Đô la chảy vào thiếu hụt được chỉ ra là nguyên nhân chính khiến đồng Won suy yếu, và đồng Won đang cho thấy mức giảm giá lớn nhất trong số các đồng tiền chủ chốt. Chính phủ nhấn mạnh rằng tình hình khác với cuộc khủng hoảng tài chính năm 1997.',
      implication:
        'Tỷ giá cao kéo dài sẽ gây áp lực tăng giá cả, gia tăng gánh nặng cho hộ gia đình và có thể ảnh hưởng tiêu cực đến tốc độ tăng trưởng kinh tế, tuy nhiên chính phủ đánh giá khả năng tái diễn khủng hoảng ngoại hối là thấp do dự trữ ngoại hối đủ lớn.',
    },
  },
  {
    category: 'tech',
    original: {
      title:
        '"Không còn đi vay nữa"... Samsung, phát triển GPU riêng \'Tuyên bố độc lập công nghệ\'',
    },
    rewrittenTitle: 'Samsung Electronics thành công phát triển GPU di động với 100% công nghệ độc quyền',
    insight: {
      fact: 'Samsung Electronics đã giới thiệu GPU di động được phát triển bằng 100% công nghệ độc quyền mà không phụ thuộc vào công nghệ bên ngoài, dự kiến sẽ được trang bị cho các sản phẩm Exynos tiếp theo.',
      context:
        'Trước đây, họ thiết kế GPU dựa trên công nghệ của AMD Mỹ, nhưng với thành công trong việc phát triển GPU riêng lần này, họ muốn giảm sự phụ thuộc vào sở hữu trí tuệ bên ngoài và tiết kiệm chi phí bản quyền khổng lồ để cải thiện lợi nhuận.',
      implication:
        'Việc tự phát triển GPU sẽ là điểm chuyển đổi quan trọng giúp tăng cường khả năng cạnh tranh bán dẫn hệ thống của Samsung Electronics và đảm bảo tính độc lập về công nghệ trong kỷ nguyên AI, đồng thời được dự báo sẽ góp phần nâng cao khả năng cạnh tranh của dòng sản phẩm Exynos.',
    },
  },
];

const editorialSynthesis = {
  topic: 'Tranh luận về việc áp dụng tuần làm việc 35 giờ',
  conflict:
    'Nâng cao chất lượng cuộc sống người lao động vs Lo ngại giảm khả năng cạnh tranh của doanh nghiệp. Hai bên đang đối đầu gay gắt về tính cấp thiết và phương pháp luận của việc giảm giờ làm.',
  argumentA:
    'Năng suất lao động của Hàn Quốc thấp hơn mức trung bình của OECD. Trong tình hình này, việc đơn phương giảm giờ làm có thể dẫn đến suy yếu khả năng cạnh tranh của doanh nghiệp, và cuối cùng gây ra tác dụng ngược là giảm việc làm. Giảm giờ làm mà không tăng năng suất là có hại cho cả doanh nghiệp và người lao động.',
  argumentB:
    'Làm việc nhiều giờ xâm phạm quyền sức khỏe của người lao động và làm giảm chất lượng cuộc sống. Giảm giờ làm là cần thiết để bảo vệ quyền cơ bản của người lao động, và ngược lại có thể góp phần tăng năng suất trong dài hạn thông qua việc cải thiện sự tập trung và giảm tỷ lệ nghỉ việc. Các nước tiên tiến cũng đã đi theo hướng này.',
  synthesis:
    'Cuộc tranh luận này không chỉ đơn thuần là vấn đề thời gian lao động, mà là câu hỏi căn bản về mô hình tăng trưởng và giá trị cuộc sống mà xã hội Hàn Quốc đang theo đuổi. Đây là bài toán cần đạt được sự đồng thuận xã hội về điểm cân bằng giữa tăng năng suất và phúc lợi người lao động.',
};

// Helper functions
function getCategoryName(category) {
  const names = {
    business: 'Kinh tế',
    tech: 'Công nghệ',
    policy: 'Chính sách',
    world: 'Quốc tế',
  };
  return names[category] || category;
}

function renderNewsItem(news) {
  const { original, rewrittenTitle, insight } = news;
  return `
    <div style="margin-bottom: 24px; padding: 16px; background: #fafafa; border-radius: 8px; border-left: 4px solid #4a4e69;">
      <p style="font-size: 12px; color: #9ca3af; text-decoration: line-through; margin: 0 0 8px 0;">
        ${original.title}
      </p>
      <h3 style="font-size: 16px; color: #1a1a2e; font-weight: 600; margin: 0 0 12px 0; line-height: 1.4;">
        ${rewrittenTitle}
      </h3>
      ${
        insight
          ? `
      <div style="background: white; padding: 12px; border-radius: 6px;">
        <p style="font-size: 13px; color: #374151; margin: 0 0 8px 0; line-height: 1.5;">
          <span style="color: #3b82f6; font-weight: 600;">📍 Fact:</span> ${insight.fact}
        </p>
        <p style="font-size: 13px; color: #374151; margin: 0 0 8px 0; line-height: 1.5;">
          <span style="color: #f59e0b; font-weight: 600;">📍 Context:</span> ${insight.context}
        </p>
        <p style="font-size: 13px; color: #374151; margin: 0; line-height: 1.5;">
          <span style="color: #10b981; font-weight: 600;">📍 Implication:</span> ${insight.implication}
        </p>
      </div>
      `
          : ''
      }
    </div>
  `;
}

// Group news by category
const newsByCategory = {};
for (const news of mockNews) {
  if (!newsByCategory[news.category]) newsByCategory[news.category] = [];
  newsByCategory[news.category].push(news);
}

// Generate news HTML
let newsHtml = '';
const categoryOrder = ['business', 'tech', 'policy', 'world'];
for (const category of categoryOrder) {
  const newsItems = newsByCategory[category];
  if (!newsItems || newsItems.length === 0) continue;
  newsHtml += `
    <div style="margin-bottom: 32px;">
      <h2 style="color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #4a4e69; padding-bottom: 8px; margin-bottom: 16px;">
        📌 ${getCategoryName(category)}
      </h2>
      ${newsItems.map(renderNewsItem).join('')}
    </div>
  `;
}

// Generate editorial HTML
const editorialHtml = `
  <div style="margin-top: 32px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px;">
    <h2 style="color: #1a1a2e; font-size: 20px; margin-bottom: 16px;">
      ⚖️ Phân tích Xã luận Hôm nay
    </h2>
    <p style="font-size: 16px; font-weight: 600; color: #343a40; margin-bottom: 12px;">
      ${editorialSynthesis.topic}
    </p>
    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #495057; margin: 0;">
        <strong>🔴 Vấn đề Cốt lõi:</strong> ${editorialSynthesis.conflict}
      </p>
    </div>
    <div style="background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #c92a2a; font-weight: 600; margin: 0 0 8px 0;">Quan điểm Bảo thủ</p>
      <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentA}</p>
    </div>
    <div style="background: #e7f5ff; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #1971c2; font-weight: 600; margin: 0 0 8px 0;">Quan điểm Tự do</p>
      <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentB}</p>
    </div>
    <div style="background: #f1f3f5; padding: 12px; border-radius: 8px;">
      <p style="font-size: 13px; color: #495057; margin: 0;">
        <strong>💡 Ý nghĩa Cấu trúc:</strong> ${editorialSynthesis.synthesis}
      </p>
    </div>
  </div>
`;

// Full HTML
const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NoCan News - ${date}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 16px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 8px 0; letter-spacing: -0.5px;">
        NoCan News
      </h1>
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">
        Tắt tiếng ồn, Bật ngữ cảnh
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
        ${date}
      </p>
      <a href="${mockArchiveUrl}" style="display: inline-block; margin-top: 12px; padding: 6px 16px; background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 12px; text-decoration: none; border-radius: 20px; border: 1px solid rgba(255,255,255,0.4);">
        Xem trên web →
      </a>
    </div>

    <!-- Protection Log -->
    <div style="background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); padding: 16px; border-bottom: 1px solid #e5e7eb;">
      <p style="color: #10b981; font-size: 14px; margin: 0;">
        🛡️ ${protectionLog}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 16px;">
      ${newsHtml}
      ${editorialHtml}
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 24px 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
        NoCan News là bản tin được AI chọn lọc.
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">
        Powered by Gemini AI • Noise Off, Context On
      </p>

      <!-- Unsubscribe Link -->
      <a href="${mockUnsubscribeUrl}" style="color: #9ca3af; font-size: 11px; text-decoration: underline;">
        Hủy đăng ký (Unsubscribe)
      </a>
    </div>

  </div>
</body>
</html>
`.trim();

// Save to file
fs.writeFileSync('email-preview.html', html);
console.log('✅ email-preview.html đã được tạo.');
console.log('Hãy mở file này trong trình duyệt để kiểm tra.');
