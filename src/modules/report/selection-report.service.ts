import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { NewsCategory } from '../../common/constants';
import {
  CategorizedNews,
  NewsItem,
  SelectionResult,
} from '../../common/interfaces';

interface CategorySelectionData {
  category: NewsCategory;
  categoryLabel: string;
  items: NewsItem[];
  selectionResult: SelectionResult;
}

@Injectable()
export class SelectionReportService {
  private readonly logger = new Logger(SelectionReportService.name);

  private readonly categoryLabels: Record<NewsCategory, string> = {
    business: 'Kinh doanh/Kinh tế',
    tech: 'Công nghệ/Khoa học',
    society: 'Xã hội',
    world: 'Quốc tế/Thế giới',
  };

  /**
   * Tạo báo cáo HTML kết quả chọn lọc AI
   */
  generateReport(
    categorizedNews: CategorizedNews,
    selectionResults: Map<NewsCategory, SelectionResult>,
  ): string {
    const categories: CategorySelectionData[] = [
      {
        category: 'business',
        categoryLabel: this.categoryLabels.business,
        items: categorizedNews.business,
        selectionResult: selectionResults.get('business')!,
      },
      {
        category: 'tech',
        categoryLabel: this.categoryLabels.tech,
        items: categorizedNews.tech,
        selectionResult: selectionResults.get('tech')!,
      },
      {
        category: 'society',
        categoryLabel: this.categoryLabels.society,
        items: categorizedNews.society,
        selectionResult: selectionResults.get('society')!,
      },
      {
        category: 'world',
        categoryLabel: this.categoryLabels.world,
        items: categorizedNews.world,
        selectionResult: selectionResults.get('world')!,
      },
    ];

    // Tính toán thống kê
    const totalCollected = categories.reduce(
      (sum, cat) => sum + cat.items.length,
      0,
    );
    const totalSelected = categories.reduce(
      (sum, cat) => sum + cat.selectionResult.selectedIndices.length,
      0,
    );
    const totalBlocked = categories.reduce(
      (sum, cat) =>
        sum +
        cat.selectionResult.filterStats.blocked.crime +
        cat.selectionResult.filterStats.blocked.gossip +
        cat.selectionResult.filterStats.blocked.politicalStrife,
      0,
    );

    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo Chọn lọc Tin tức AI - ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header .date { opacity: 0.8; font-size: 14px; }

    /* Stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card .number { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .stat-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-card.selected .number { color: #10b981; }
    .stat-card.blocked .number { color: #ef4444; }

    /* Category Section */
    .category-section {
      background: white;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .category-header {
      background: #1a1a2e;
      color: white;
      padding: 15px 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .category-header:hover { background: #16213e; }
    .category-header h2 { font-size: 18px; }
    .category-header .badge {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
    }
    .category-header .toggle { font-size: 20px; }

    .category-content { display: none; padding: 0; }
    .category-content.open { display: block; }

    /* Filter Stats */
    .filter-stats {
      display: flex;
      gap: 20px;
      padding: 15px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
      flex-wrap: wrap;
    }
    .filter-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .filter-stat .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .filter-stat .dot.crime { background: #ef4444; }
    .filter-stat .dot.gossip { background: #f59e0b; }
    .filter-stat .dot.political { background: #8b5cf6; }

    /* News Table */
    .news-table {
      width: 100%;
      border-collapse: collapse;
    }
    .news-table th {
      background: #f8f9fa;
      padding: 12px 15px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      border-bottom: 2px solid #eee;
    }
    .news-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    .news-table tr:hover { background: #fafafa; }
    .news-table .idx {
      width: 50px;
      text-align: center;
      color: #999;
      font-family: monospace;
    }
    .news-table .title-cell { max-width: 400px; }
    .news-table .title {
      font-weight: 500;
      color: #1a1a2e;
      display: block;
      margin-bottom: 4px;
    }
    .news-table .snippet {
      font-size: 13px;
      color: #666;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .news-table .link {
      font-size: 12px;
      color: #3b82f6;
      text-decoration: none;
      word-break: break-all;
    }
    .news-table .link:hover { text-decoration: underline; }

    /* Selected Row */
    .news-table tr.selected {
      background: #ecfdf5 !important;
    }
    .news-table tr.selected td:first-child {
      border-left: 4px solid #10b981;
    }
    .selected-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 8px;
      vertical-align: middle;
    }

    /* Legend */
    .legend {
      display: flex;
      gap: 20px;
      padding: 15px 20px;
      background: #f0fdf4;
      border-top: 1px solid #d1fae5;
      font-size: 13px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-item .box {
      width: 16px;
      height: 16px;
      background: #ecfdf5;
      border: 2px solid #10b981;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Báo cáo Phân tích Chất lượng Chọn lọc Tin tức AI</h1>
      <div class="date">Được tạo: ${dateStr}</div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="number">${totalCollected}</div>
        <div class="label">Tổng thu thập</div>
      </div>
      <div class="stat-card selected">
        <div class="number">${totalSelected}</div>
        <div class="label">Đã chọn</div>
      </div>
      <div class="stat-card blocked">
        <div class="number">${totalBlocked}</div>
        <div class="label">Đã chặn</div>
      </div>
      <div class="stat-card">
        <div class="number">${((totalSelected / totalCollected) * 100).toFixed(1)}%</div>
        <div class="label">Tỷ lệ chọn</div>
      </div>
    </div>

    ${categories.map((cat) => this.renderCategorySection(cat)).join('\n')}
  </div>

  <script>
    document.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.toggle');
        content.classList.toggle('open');
        toggle.textContent = content.classList.contains('open') ? '−' : '+';
      });
    });
    // Tự động mở danh mục đầu tiên
    document.querySelector('.category-content')?.classList.add('open');
    document.querySelector('.toggle').textContent = '−';
  </script>
</body>
</html>`;
  }

  /**
   * Render section danh mục
   */
  private renderCategorySection(data: CategorySelectionData): string {
    const { categoryLabel, items, selectionResult } = data;
    const selectedIndices = new Set(selectionResult.selectedIndices);
    const { blocked } = selectionResult.filterStats;

    return `
    <div class="category-section">
      <div class="category-header">
        <h2>${categoryLabel}</h2>
        <div>
          <span class="badge">${items.length} tin thu thập / ${selectedIndices.size} tin đã chọn</span>
          <span class="toggle">+</span>
        </div>
      </div>
      <div class="category-content">
        <div class="filter-stats">
          <div class="filter-stat">
            <span class="dot crime"></span>
            <span>Tội phạm: ${blocked.crime} tin</span>
          </div>
          <div class="filter-stat">
            <span class="dot gossip"></span>
            <span>Chuyện phiếm: ${blocked.gossip} tin</span>
          </div>
          <div class="filter-stat">
            <span class="dot political"></span>
            <span>Tranh cãi chính trị: ${blocked.politicalStrife} tin</span>
          </div>
        </div>
        <table class="news-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tiêu đề / Tóm tắt</th>
              <th>Liên kết</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => this.renderNewsRow(item, idx, selectedIndices.has(idx))).join('\n')}
          </tbody>
        </table>
        <div class="legend">
          <div class="legend-item">
            <span class="box"></span>
            <span>Tin tức được AI chọn</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  /**
   * Render hàng tin tức
   */
  private renderNewsRow(
    item: NewsItem,
    idx: number,
    isSelected: boolean,
  ): string {
    const escapedTitle = this.escapeHtml(item.title);
    const escapedSnippet = this.escapeHtml(item.snippet || '');

    return `
            <tr class="${isSelected ? 'selected' : ''}">
              <td class="idx">${idx}</td>
              <td class="title-cell">
                <span class="title">
                  ${escapedTitle}
                  ${isSelected ? '<span class="selected-badge">Đã chọn</span>' : ''}
                </span>
                <span class="snippet">${escapedSnippet}</span>
              </td>
              <td>
                <a href="${item.link}" target="_blank" class="link">${this.truncateUrl(item.link)}</a>
              </td>
            </tr>`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Rút gọn URL
   */
  private truncateUrl(url: string): string {
    if (url.length <= 50) return url;
    return url.slice(0, 47) + '...';
  }

  /**
   * Lưu file báo cáo
   * @returns Đường dẫn file đã lưu
   */
  saveReport(html: string, filename?: string): string {
    const reportsDir = path.join(process.cwd(), 'reports');

    // Tạo thư mục reports
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Tạo tên file
    const now = new Date();
    // Sử dụng format YYYY-MM-DD an toàn cho tên file, tránh phụ thuộc locale
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}${minutes}`;

    const finalFilename =
      filename || `selection-report-${dateStr}-${timeStr}.html`;
    const filePath = path.join(reportsDir, finalFilename);

    // Lưu file
    fs.writeFileSync(filePath, html, 'utf-8');
    this.logger.log(`Selection report saved: ${filePath}`);

    return filePath;
  }
}
