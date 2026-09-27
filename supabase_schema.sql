-- Run this in your Supabase SQL Editor:
-- (Safe to run multiple times)

create table if not exists responses (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date text not null,
  answers jsonb not null,
  result text not null
);

-- Enable Row Level Security (RLS)
alter table responses enable row level security;

-- Drop existing policies if they already exist
drop policy if exists "Allow anonymous inserts" on responses;
drop policy if exists "Allow read access" on responses;

-- Allow anonymous inserts (from survey checks)
create policy "Allow anonymous inserts" on responses
  for insert
  with check (true);

-- Allow reads (for admin stats dashboard)
create policy "Allow read access" on responses
  for select
  using (true);
