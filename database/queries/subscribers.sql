-- =============================================
-- Subscribers Table Queries Reference
-- =============================================

-- Get all active subscriber emails
SELECT email
FROM public.subscribers
WHERE is_active = true;

-- Add new subscriber
INSERT INTO public.subscribers (email)
VALUES ('example@email.com')
RETURNING *;

-- Deactivate subscriber (unsubscribe)
UPDATE public.subscribers
SET is_active = false
WHERE email = 'example@email.com';

-- Reactivate subscriber
UPDATE public.subscribers
SET is_active = true
WHERE email = 'example@email.com';

-- Get subscriber count
SELECT
  COUNT(*) FILTER (WHERE is_active = true) AS active_count,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_count,
  COUNT(*) AS total_count
FROM public.subscribers;

-- Find subscriber by email
SELECT *
FROM public.subscribers
WHERE email = 'example@email.com';

-- List all subscribers with pagination
SELECT id, email, is_active, created_at
FROM public.subscribers
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
