create table if not exists public.project_activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  title text not null,
  description text not null,
  actor text not null,
  activity_type text not null default 'project_update',
  created_at timestamptz not null default now()
);

alter table public.project_activity_logs enable row level security;

create policy "Project activity logs viewable by authenticated users"
on public.project_activity_logs
for select
to authenticated
using (true);

create policy "Authenticated users can create project activity logs"
on public.project_activity_logs
for insert
to authenticated
with check (true);

create policy "Authenticated users can update project activity logs"
on public.project_activity_logs
for update
to authenticated
using (true);

create index if not exists idx_project_activity_logs_project
on public.project_activity_logs(project_id);

create index if not exists idx_project_activity_logs_created_at
on public.project_activity_logs(created_at desc);
