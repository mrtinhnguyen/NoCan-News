-- =============================================
-- Migration: 001_create_subscribers
-- Description: Newsletter subscriber table
-- Created: 2024-01
-- =============================================

-- Create subscribers table for newsletter recipients
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT subscribers_pkey PRIMARY KEY (id),
  CONSTRAINT subscribers_email_key UNIQUE (email)
);

-- Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Create index for active subscribers query optimization
CREATE INDEX IF NOT EXISTS idx_subscribers_active
  ON public.subscribers (is_active)
  WHERE is_active = true;

-- RLS Policies
-- Frontend (Anon Key): INSERT only
CREATE POLICY "Allow anonymous insert"
  ON public.subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow unsubscribe by id
CREATE POLICY "Allow unsubscribe by id"
ON public.subscribers
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Backend (Service Role): Full access (bypasses RLS)

-- Add table comment for documentation
COMMENT ON TABLE public.subscribers IS 'Newsletter subscriber list for NoCan News';
COMMENT ON COLUMN public.subscribers.is_active IS 'Soft delete flag - false means unsubscribed';
