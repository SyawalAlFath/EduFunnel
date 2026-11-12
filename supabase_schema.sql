-- EduFunnel Supabase schema and seed data
-- Run this file in Supabase SQL Editor.

begin;

drop table if exists public.monthly_channel_traffic cascade;
drop table if exists public.daily_channel_traffic cascade;
drop table if exists public.funnel_sources cascade;
drop table if exists public.summary_metrics cascade;

create table if not exists public.summary_metrics (
  id bigint generated always as identity primary key,
  project_name text not null,
  period text not null unique,
  generated_by text not null,
  total_pengunjung integer not null,
  total_daftar integer not null,
  total_test integer not null,
  total_daftar_ulang integer not null,
  total_berkuliah integer not null,
  funnel_stages jsonb not null,
  funnel_data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.funnel_sources (
  id bigint generated always as identity primary key,
  period text not null references public.summary_metrics(period) on delete cascade,
  name text not null,
  pengunjung integer not null,
  daftar integer not null,
  test integer not null,
  daftar_ulang integer not null,
  berkuliah integer not null,
  conversion_rate numeric(6, 2) not null,
  drop_off numeric(6, 2) not null,
  progression_rates jsonb not null default '{}'::jsonb,
  attrition_rates jsonb not null default '{}'::jsonb,
  ranking integer not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (period, name)
);

create table if not exists public.monthly_channel_traffic (
  id bigint generated always as identity primary key,
  period text not null references public.summary_metrics(period) on delete cascade,
  month_order smallint not null,
  month text not null,
  google_ads integer not null,
  instagram integer not null,
  twitter_x integer not null,
  website integer not null,
  created_at timestamptz not null default now(),
  unique (period, month_order)
);

create table if not exists public.daily_channel_traffic (
  id bigint generated always as identity primary key,
  date date not null,
  channel text not null,
  pengunjung integer not null,
  daftar integer not null,
  test integer not null,
  daftar_ulang integer not null,
  berkuliah integer not null,
  created_at timestamptz not null default now(),
  unique (date, channel)
);

alter table public.summary_metrics enable row level security;
alter table public.funnel_sources enable row level security;
alter table public.monthly_channel_traffic enable row level security;
alter table public.daily_channel_traffic enable row level security;

drop policy if exists "Allow public read summary metrics" on public.summary_metrics;
drop policy if exists "Allow public read funnel sources" on public.funnel_sources;
drop policy if exists "Allow public read monthly traffic" on public.monthly_channel_traffic;
drop policy if exists "Allow public read daily traffic" on public.daily_channel_traffic;

create policy "Allow public read summary metrics"
on public.summary_metrics
for select
to anon
using (true);

create policy "Allow public read funnel sources"
on public.funnel_sources
for select
to anon
using (true);

create policy "Allow public read monthly traffic"
on public.monthly_channel_traffic
for select
to anon
using (true);

create policy "Allow public read daily traffic"
on public.daily_channel_traffic
for select
to anon
using (true);

delete from public.daily_channel_traffic;
delete from public.monthly_channel_traffic where period = '2025';
delete from public.funnel_sources where period = '2025';
delete from public.summary_metrics where period = '2025';

insert into public.summary_metrics (
  project_name,
  period,
  generated_by,
  total_pengunjung,
  total_daftar,
  total_test,
  total_daftar_ulang,
  total_berkuliah,
  funnel_stages,
  funnel_data
) values (
  'EduFunnel',
  '2025',
  'Frontend Dashboard System',
  1000,
  415,
  208,
  104,
  51,
  '["Pengunjung", "Daftar", "Test", "Daftar Ulang", "Berkuliah"]'::jsonb,
  '[1000, 415, 208, 104, 51]'::jsonb
);

insert into public.funnel_sources (
  period,
  name,
  pengunjung,
  daftar,
  test,
  daftar_ulang,
  berkuliah,
  conversion_rate,
  drop_off,
  progression_rates,
  attrition_rates,
  ranking,
  status
) values
(
  '2025',
  'Google Ads',
  256,
  103,
  52,
  26,
  14,
  5.47,
  94.53,
  '{"pengunjung_to_daftar": 40.2, "daftar_to_test": 50.5, "test_to_daftar_ulang": 50.0, "daftar_ulang_to_berkuliah": 53.8}'::jsonb,
  '{"pengunjung_to_daftar": 59.8, "daftar_to_test": 49.5, "test_to_daftar_ulang": 50.0, "daftar_ulang_to_berkuliah": 46.2}'::jsonb,
  1,
  'Top'
),
(
  '2025',
  'Instagram',
  266,
  111,
  55,
  28,
  14,
  5.26,
  94.74,
  '{"pengunjung_to_daftar": 41.7, "daftar_to_test": 49.5, "test_to_daftar_ulang": 50.9, "daftar_ulang_to_berkuliah": 50.0}'::jsonb,
  '{"pengunjung_to_daftar": 58.3, "daftar_to_test": 50.5, "test_to_daftar_ulang": 49.1, "daftar_ulang_to_berkuliah": 50.0}'::jsonb,
  2,
  'Stable'
),
(
  '2025',
  'Twitter/X',
  227,
  94,
  47,
  23,
  10,
  4.41,
  95.59,
  '{"pengunjung_to_daftar": 41.4, "daftar_to_test": 50.0, "test_to_daftar_ulang": 48.9, "daftar_ulang_to_berkuliah": 43.5}'::jsonb,
  '{"pengunjung_to_daftar": 58.6, "daftar_to_test": 50.0, "test_to_daftar_ulang": 51.1, "daftar_ulang_to_berkuliah": 56.5}'::jsonb,
  4,
  'Alert'
),
(
  '2025',
  'Website',
  251,
  107,
  54,
  27,
  13,
  5.18,
  94.82,
  '{"pengunjung_to_daftar": 42.6, "daftar_to_test": 50.5, "test_to_daftar_ulang": 50.0, "daftar_ulang_to_berkuliah": 48.1}'::jsonb,
  '{"pengunjung_to_daftar": 57.4, "daftar_to_test": 49.5, "test_to_daftar_ulang": 50.0, "daftar_ulang_to_berkuliah": 51.9}'::jsonb,
  3,
  'Stable'
);

insert into public.monthly_channel_traffic (
  period,
  month_order,
  month,
  google_ads,
  instagram,
  twitter_x,
  website
) values
('2025', 1, 'Jan', 19, 18, 23, 18),
('2025', 2, 'Feb', 25, 22, 23, 20),
('2025', 3, 'Mar', 14, 16, 14, 16),
('2025', 4, 'Apr', 18, 23, 21, 29),
('2025', 5, 'May', 29, 23, 24, 20),
('2025', 6, 'Jun', 29, 13, 15, 27),
('2025', 7, 'Jul', 12, 25, 17, 21),
('2025', 8, 'Aug', 24, 26, 23, 31),
('2025', 9, 'Sep', 19, 27, 15, 21),
('2025', 10, 'Oct', 24, 26, 15, 14),
('2025', 11, 'Nov', 15, 21, 21, 15),
('2025', 12, 'Dec', 28, 26, 16, 19);

insert into public.daily_channel_traffic (
  date,
  channel,
  pengunjung,
  daftar,
  test,
  daftar_ulang,
  berkuliah
) values
('2025-12-25', 'Google Ads', 1, 1, 1, 0, 0),
('2025-12-25', 'Instagram', 1, 0, 0, 0, 0),
('2025-12-25', 'Twitter/X', 1, 0, 0, 0, 0),
('2025-12-25', 'Website', 0, 0, 0, 0, 0),
('2025-12-26', 'Google Ads', 1, 1, 0, 0, 0),
('2025-12-26', 'Instagram', 1, 1, 0, 0, 0),
('2025-12-26', 'Twitter/X', 0, 0, 0, 0, 0),
('2025-12-26', 'Website', 1, 0, 0, 0, 0),
('2025-12-27', 'Google Ads', 1, 0, 0, 0, 0),
('2025-12-27', 'Instagram', 1, 0, 0, 0, 0),
('2025-12-27', 'Twitter/X', 1, 1, 1, 0, 0),
('2025-12-27', 'Website', 0, 0, 0, 0, 0),
('2025-12-28', 'Google Ads', 1, 1, 1, 1, 0),
('2025-12-28', 'Instagram', 1, 1, 1, 1, 0),
('2025-12-28', 'Twitter/X', 0, 0, 0, 0, 0),
('2025-12-28', 'Website', 1, 0, 0, 0, 0),
('2025-12-29', 'Google Ads', 1, 0, 0, 0, 0),
('2025-12-29', 'Instagram', 1, 0, 0, 0, 0),
('2025-12-29', 'Twitter/X', 1, 0, 0, 0, 0),
('2025-12-29', 'Website', 0, 0, 0, 0, 0),
('2025-12-30', 'Google Ads', 1, 1, 0, 0, 0),
('2025-12-30', 'Instagram', 1, 1, 0, 0, 0),
('2025-12-30', 'Twitter/X', 0, 0, 0, 0, 0),
('2025-12-30', 'Website', 1, 1, 0, 0, 0),
('2025-12-31', 'Google Ads', 1, 0, 0, 0, 0),
('2025-12-31', 'Instagram', 0, 0, 0, 0, 0),
('2025-12-31', 'Twitter/X', 1, 1, 0, 0, 0),
('2025-12-31', 'Website', 1, 0, 0, 0, 0);

commit;
