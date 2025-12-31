const fs = require('fs');

// Mock data
const date = '2025-12-27';
const mockUnsubscribeUrl = 'https://nocan-news.vercel.app/unsubscribe?id=123';
const protectionLog =
  '오늘 AI가 총 1,247건을 스캔하여 범죄 45건, 가십 89건, 정치적 비방 123건을 차단했습니다.';

const mockNews = [
  {
    category: 'business',
    original: {
      title: '개미들 곡소리... 삼성전자 4만전자 가나?',
      source: '한국경제',
    },
    rewrittenTitle: '삼성전자, 업황 둔화로 52주 신저가 기록',
    insight: {
      fact: '삼성전자 주가가 52주 최저가를 기록했다.',
      context:
        '글로벌 반도체 수요 둔화와 메모리 가격 하락 압박이 지속되고 있다.',
      implication:
        '반도체 업황 회복 시점에 따라 주가 반등 가능성이 결정될 전망이다.',
    },
  },
  {
    category: 'tech',
    original: {
      title: 'AI 거품 터지나... 빅테크 주가 폭락 공포',
      source: '조선비즈',
    },
    rewrittenTitle: '미국 빅테크 기업 주가, AI 투자 수익성 우려로 조정 국면',
    insight: {
      fact: '미국 주요 빅테크 기업들의 주가가 일제히 하락했다.',
      context:
        'AI 인프라 투자 대비 수익화 지연에 대한 시장의 우려가 반영되었다.',
      implication:
        'AI 기술의 실질적 수익 창출 여부가 향후 주가 방향을 결정할 핵심 변수다.',
    },
  },
];

const editorialSynthesis = {
  topic: '주 35시간 근로제 도입 논쟁',
  conflict:
    '노동자 삶의 질 향상 vs 기업 경쟁력 저하 우려. 양측은 근로시간 단축의 시급성과 방법론에서 첨예하게 대립하고 있다.',
  argumentA:
    '한국의 노동생산성은 OECD 평균 대비 낮은 수준이다. 이 상황에서 근로시간을 일방적으로 단축하면 기업의 경쟁력 약화로 이어질 수 있으며, 결국 고용 감소라는 역효과를 초래할 수 있다. 생산성 향상 없는 근로시간 단축은 기업과 노동자 모두에게 해롭다.',
  argumentB:
    '장시간 노동은 노동자의 건강권을 침해하고 삶의 질을 저하시킨다. 근로시간 단축은 노동자의 기본권 보호 차원에서 필수적이며, 오히려 집중력 향상과 이직률 감소를 통해 장기적으로 생산성 향상에 기여할 수 있다. 선진국들도 이미 이 방향으로 나아가고 있다.',
  synthesis:
    '이 논쟁은 단순한 노동시간의 문제가 아니라, 한국 사회가 추구하는 성장 모델과 삶의 가치에 대한 근본적 질문이다. 생산성 향상과 근로자 복지 사이의 균형점을 사회적 합의로 도출해야 하는 과제다.',
};

// Helper functions
function getCategoryName(category) {
  const names = {
    business: '경제',
    tech: '기술',
    policy: '정책',
    world: '국제',
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
      <p style="font-size: 11px; color: #6b7280; margin: 0 0 12px 0;">
        📰 ${original.source}
      </p>
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
      ⚖️ 오늘의 사설 분석
    </h2>
    <p style="font-size: 16px; font-weight: 600; color: #343a40; margin-bottom: 12px;">
      ${editorialSynthesis.topic}
    </p>
    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #495057; margin: 0;">
        <strong>🔴 핵심 쟁점:</strong> ${editorialSynthesis.conflict}
      </p>
    </div>
    <div style="background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #c92a2a; font-weight: 600; margin: 0 0 8px 0;">보수 측 논리</p>
      <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentA}</p>
    </div>
    <div style="background: #e7f5ff; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <p style="font-size: 14px; color: #1971c2; font-weight: 600; margin: 0 0 8px 0;">진보 측 논리</p>
      <p style="font-size: 14px; color: #495057; margin: 0; line-height: 1.6;">${editorialSynthesis.argumentB}</p>
    </div>
    <div style="background: #f1f3f5; padding: 12px; border-radius: 8px;">
      <p style="font-size: 13px; color: #495057; margin: 0;">
        <strong>💡 구조적 의미:</strong> ${editorialSynthesis.synthesis}
      </p>
    </div>
  </div>
`;

// Full HTML
const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NoCan News - ${date}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 100%; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 16px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 8px 0; letter-spacing: -0.5px;">
        NoCan News
      </h1>
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">
        세상의 소음은 끄고, 구조적 맥락만 남긴다
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
        ${date}
      </p>
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
        NoCan News는 AI가 큐레이션하는 뉴스레터입니다.
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">
        Powered by Gemini AI • Noise Off, Context On
      </p>

      <!-- Unsubscribe Link -->
      <a href="${mockUnsubscribeUrl}" style="color: #9ca3af; font-size: 11px; text-decoration: underline;">
        수신거부 (Unsubscribe)
      </a>
    </div>

  </div>
</body>
</html>
`.trim();

// Save to file
fs.writeFileSync('email-preview.html', html);
console.log('✅ email-preview.html 파일이 생성되었습니다.');
console.log('브라우저에서 열어 확인하세요.');
