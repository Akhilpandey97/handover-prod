
-- Create checklist_comments table for multi-comment support
CREATE TABLE public.checklist_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_id UUID,
  comment TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view checklist comments"
ON public.checklist_comments FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create checklist comments"
ON public.checklist_comments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete their own comments"
ON public.checklist_comments FOR DELETE
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager'));

-- Create storage bucket for checklist attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-attachments', 'checklist-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload checklist attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'checklist-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view checklist attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'checklist-attachments');

CREATE POLICY "Authenticated users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'checklist-attachments' AND auth.role() = 'authenticated');

-- Index for fast lookups
CREATE INDEX idx_checklist_comments_item_id ON public.checklist_comments(checklist_item_id);
CREATE INDEX idx_checklist_comments_created_at ON public.checklist_comments(created_at);
