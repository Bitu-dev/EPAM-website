CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'contact',
  name text NOT NULL,
  email text NOT NULL,
  organization text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.inquiries TO anon, authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit inquiries" ON public.inquiries FOR INSERT TO anon, authenticated
WITH CHECK (kind IN ('contact','partner','support') AND length(name) BETWEEN 1 AND 120 AND length(email) BETWEEN 3 AND 255 AND length(message) BETWEEN 1 AND 3000);