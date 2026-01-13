-- =============================================
-- Migration: 002_create_newsletters
-- Description: Newsletter archive table for storing sent newsletters
-- Created: 2025-01
-- =============================================

-- Create newsletters table for archiving sent newsletters
CREATE TABLE IF NOT EXISTS public.newsletters (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  send_date DATE NOT NULL,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT newsletters_pkey PRIMARY KEY (id),
  CONSTRAINT newsletters_send_date_key UNIQUE (send_date)
);

-- Enable Row Level Security
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_newsletters_send_date
  ON public.newsletters (send_date DESC);

-- RLS Policies
-- Frontend (Anon Key): SELECT only (for archive page)
CREATE POLICY "Allow public read"
  ON public.newsletters
  FOR SELECT
  TO anon
  USING (true);

-- Backend (Service Role): Full access (bypasses RLS)

-- Add table comment for documentation
COMMENT ON TABLE public.newsletters IS 'Archive of sent newsletters for NoCan News landing page';
COMMENT ON COLUMN public.newsletters.send_date IS 'Date when newsletter was sent (KST)';
COMMENT ON COLUMN public.newsletters.content_html IS 'Rendered HTML content of the newsletter';
COMMENT ON COLUMN public.newsletters.content_data IS 'Structured JSON data: filter_stats, news_items, editorial_analysis';
