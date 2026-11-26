ALTER TABLE support_threads
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS platform text;
