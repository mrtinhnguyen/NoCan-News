import { EditorialStance } from '../constants';

/**
 * Mục xã luận đã thu thập
 */
export interface Editorial {
  title: string;
  link: string;
  pubDate: string;
  content?: string; // Nội dung sau khi cào
  stance: EditorialStance;
}

/**
 * Phân tích tổng hợp xã luận từ AI
 */
export interface EditorialSynthesis {
  topic: string;
  conflict: string; // Điểm tranh luận cốt lõi
  argumentA: string; // Luận điểm phe Bảo thủ
  argumentB: string; // Luận điểm phe Tự do
  synthesis: string; // Ý nghĩa cấu trúc/thời đại
}

/**
 * Dữ liệu bản tin
 */
export interface NewsletterData {
  date: string;
  protectionLog: string;
  processedNews: import('./news-item.interface').ProcessedNews[];
  editorialSynthesis?: EditorialSynthesis;
}
