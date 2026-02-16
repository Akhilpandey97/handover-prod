
-- Table to store parsed emails from Gmail polling
CREATE TABLE public.parsed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  gmail_message_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  sender TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  brand_name TEXT,
  brand_url TEXT,
  platform TEXT,
  sub_platform TEXT,
  arr NUMERIC,
  category TEXT,
  txns_per_day INTEGER,
  aov NUMERIC,
  merchant_size TEXT,
  city TEXT,
  sales_notes TEXT,
  parsed_fields JSONB DEFAULT '{}'::jsonb,
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'project_created', 'dismissed')),
  project_id UUID REFERENCES public.projects(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gmail_message_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.parsed_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Parsed emails viewable by tenant"
  ON public.parsed_emails FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can insert parsed emails"
  ON public.parsed_emails FOR INSERT
  WITH CHECK ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can update parsed emails"
  ON public.parsed_emails FOR UPDATE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can delete parsed emails"
  ON public.parsed_emails FOR DELETE
  USING ((is_manager(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_parsed_emails_updated_at
  BEFORE UPDATE ON public.parsed_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
