-- =============================================
-- Migration: 003_issue_tracking
-- Mô tả: Tính năng theo dõi vấn đề với báo cáo AI tạo sẵn và kiểm thử fake door
-- Created: 2026-01
-- =============================================

-- ===========================================
-- Phần 1: Cập nhật bảng newsletters
-- ===========================================

-- Thêm cột all_keywords cho tìm kiếm theo dõi vấn đề
ALTER TABLE public.newsletters
ADD COLUMN IF NOT EXISTS all_keywords TEXT[] DEFAULT '{}';

-- Tạo chỉ mục GIN cho tìm kiếm từ khóa
CREATE INDEX IF NOT EXISTS idx_newsletters_keywords
  ON public.newsletters USING GIN (all_keywords);

-- Thêm comment cho cột
COMMENT ON COLUMN public.newsletters.all_keywords IS 'Từ khóa do AI trích xuất để tìm kiếm theo dõi vấn đề';

-- ===========================================
-- Phần 2: Tạo bảng issue_tracks
-- ===========================================

CREATE TABLE IF NOT EXISTS public.issue_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  display_title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_report_html TEXT,
  last_report_data JSONB,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT issue_tracks_pkey PRIMARY KEY (id),
  CONSTRAINT issue_tracks_keyword_key UNIQUE (keyword)
);

-- Bật bảo mật cấp hàng (Row Level Security)
ALTER TABLE public.issue_tracks ENABLE ROW LEVEL SECURITY;

-- Tạo chỉ mục một phần cho các vấn đề đang hoạt động
CREATE INDEX IF NOT EXISTS idx_issue_tracks_active
  ON public.issue_tracks (is_active) WHERE is_active = true;

-- RLS Policies
-- Frontend (Anon Key): Chỉ SELECT cho các vấn đề đang hoạt động
CREATE POLICY "Allow public read active issues"
  ON public.issue_tracks
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Backend (Service Role): Truy cập đầy đủ (bỏ qua RLS)

-- Thêm comment cho bảng
COMMENT ON TABLE public.issue_tracks IS 'Các vấn đề được theo dõi với báo cáo AI tạo sẵn cho tính năng phân tích sâu';
COMMENT ON COLUMN public.issue_tracks.keyword IS 'Từ khóa tìm kiếm chính (ví dụ: "Tăng chỉ tiêu trường y")';
COMMENT ON COLUMN public.issue_tracks.display_title IS 'Tiêu đề hiển thị cho người dùng';
COMMENT ON COLUMN public.issue_tracks.last_report_html IS 'Báo cáo HTML được AI tạo sẵn';
COMMENT ON COLUMN public.issue_tracks.last_report_data IS 'Dữ liệu JSON có cấu trúc để truy cập API';

-- ===========================================
-- Phần 3: Tạo bảng payment_intent_logs
-- ===========================================

CREATE TABLE IF NOT EXISTS public.payment_intent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  issue_track_id UUID REFERENCES public.issue_tracks(id),
  target_issue TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payment_intent_logs_pkey PRIMARY KEY (id)
);

-- Bật bảo mật cấp hàng (chỉ backend, không có truy cập công khai)
ALTER TABLE public.payment_intent_logs ENABLE ROW LEVEL SECURITY;

-- Tạo chỉ mục cho truy vấn phân tích
CREATE INDEX IF NOT EXISTS idx_payment_intent_logs_issue
  ON public.payment_intent_logs (target_issue, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_intent_logs_date
  ON public.payment_intent_logs (clicked_at DESC);

-- Thêm comment cho bảng
COMMENT ON TABLE public.payment_intent_logs IS 'Ghi nhật ký ý định thanh toán (Fake door) để nghiên cứu người dùng';
COMMENT ON COLUMN public.payment_intent_logs.issue_track_id IS 'Khóa ngoại đến issue_tracks (có thể null nếu tìm kiếm không liên kết)';
COMMENT ON COLUMN public.payment_intent_logs.target_issue IS 'Từ khóa của vấn đề nơi người dùng nhấp nút thanh toán';
COMMENT ON COLUMN public.payment_intent_logs.ip_address IS 'Địa chỉ IP người dùng để phát hiện trùng lặp';
