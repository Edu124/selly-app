-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — the last two features that still needed the old server.  SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RUN AFTER FIX_010 THROUGH FIX_013.
--
-- WHAT THIS IS FOR
--   Accounting and Payroll were the only screens left calling the Instagram-bot
--   server on Railway. That server was never a separate database -- it queried
--   this one with supabaseAdmin -- but its tables were defined over there and
--   are not in this project's migrations. These are.
--
--   Everything else the app does already talks to Supabase directly.
--
-- ON business_id
--   uuid, matching every other table added by this project and referencing
--   auth.users, so RLS is a plain comparison with auth.uid(). Note that
--   public.orders.business_id is TEXT for historical reasons -- anywhere the two
--   meet, cast. The revenue query below is the one place that happens here.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · Money going out ──────────────────────────────────────────────────────

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users (id) on delete cascade,

  amount      numeric(12,2) not null check (amount >= 0),
  category    text,
  description text,
  vendor      text,

  -- The day the money was spent, which is frequently not the day it was typed
  -- in. Kept apart from created_at for exactly that reason.
  spent_on    date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_business_idx
  on public.expenses (business_id, spent_on desc);

alter table public.expenses enable row level security;

drop policy if exists "expenses owner all" on public.expenses;
create policy "expenses owner all" on public.expenses
  for all using (business_id = auth.uid()) with check (business_id = auth.uid());


-- ── 2 · Staff ────────────────────────────────────────────────────────────────

create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users (id) on delete cascade,

  name        text not null,
  role        text,
  salary      numeric(12,2) not null default 0 check (salary >= 0),
  mobile      text,

  -- Removing somebody from the list must not erase the payroll they were
  -- already paid. Deactivating keeps the history intact and honest.
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists employees_business_idx
  on public.employees (business_id, active, name);

alter table public.employees enable row level security;

drop policy if exists "employees owner all" on public.employees;
create policy "employees owner all" on public.employees
  for all using (business_id = auth.uid()) with check (business_id = auth.uid());


-- ── 3 · Who turned up ────────────────────────────────────────────────────────

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,

  on_date     date not null,
  status      text not null check (status in ('present', 'absent', 'half')),
  created_at  timestamptz not null default now()
);

-- One mark per person per day. Tapping P then A should correct the record, not
-- leave two contradictory rows for the same morning.
create unique index if not exists attendance_unique_idx
  on public.attendance (business_id, employee_id, on_date);

alter table public.attendance enable row level security;

drop policy if exists "attendance owner all" on public.attendance;
create policy "attendance owner all" on public.attendance
  for all using (business_id = auth.uid()) with check (business_id = auth.uid());


-- ── 4 · What was actually paid ───────────────────────────────────────────────
-- A run is a record of a decision, not a view over the current data. Salaries
-- change and attendance gets corrected; a payslip issued in March must still
-- say in June what it said in March.

create table if not exists public.payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references auth.users (id) on delete cascade,
  employee_id   uuid references public.employees (id) on delete set null,

  month         text not null,                    -- 'YYYY-MM'
  employee_name text not null,                    -- copied: the person may later be removed
  base_salary   numeric(12,2) not null default 0,
  days_present  numeric(5,1)  not null default 0, -- half days are 0.5
  total_days    int           not null default 0,
  deductions    numeric(12,2) not null default 0,
  net_salary    numeric(12,2) not null default 0,
  paid          boolean       not null default false,
  created_at    timestamptz not null default now()
);

create unique index if not exists payroll_runs_unique_idx
  on public.payroll_runs (business_id, employee_id, month);

alter table public.payroll_runs enable row level security;

drop policy if exists "payroll_runs owner all" on public.payroll_runs;
create policy "payroll_runs owner all" on public.payroll_runs
  for all using (business_id = auth.uid()) with check (business_id = auth.uid());


-- ── 5 · Revenue against costs ────────────────────────────────────────────────
-- Revenue counts delivered orders only. An order that was placed and then
-- cancelled is not money, and counting it flatters the number in the one
-- direction a business owner cannot afford to be flattered.

create or replace function public.accounting_summary(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bid     uuid := auth.uid();
  v_from    date := current_date - greatest(coalesce(p_days, 30), 1);
  v_revenue numeric := 0;
  v_spend   numeric := 0;
  v_cats    jsonb   := '[]'::jsonb;
begin
  if v_bid is null then
    raise exception 'sign in first';
  end if;

  -- orders.business_id is TEXT; auth.uid() is uuid. Cast, or this silently
  -- returns nothing at all.
  select coalesce(sum((o.bill ->> 'total')::numeric), 0)
    into v_revenue
    from public.orders o
   where o.business_id::text = v_bid::text
     and o.status = 'delivered'
     and o.created_at >= v_from;

  select coalesce(sum(e.amount), 0)
    into v_spend
    from public.expenses e
   where e.business_id = v_bid
     and e.spent_on >= v_from;

  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'total', c.total)
                            order by c.total desc), '[]'::jsonb)
    into v_cats
    from (
      select coalesce(nullif(btrim(e.category), ''), 'Uncategorised') as category,
             sum(e.amount) as total
        from public.expenses e
       where e.business_id = v_bid
         and e.spent_on >= v_from
       group by 1
    ) c;

  return jsonb_build_object(
    'revenue',  v_revenue,
    'expenses', v_spend,
    -- Nothing in this product captures GST yet: no tax rate on a dish, no GSTIN
    -- on a bill. Returning zeros keeps the screen's shape while being truthful
    -- that the figure is not known, rather than inventing one from a percentage.
    'gst_collected', 0,
    'gst_paid',      0,
    'by_category',   v_cats
  );
end;
$fn$;

revoke all on function public.accounting_summary(int) from public, anon;
grant execute on function public.accounting_summary(int) to authenticated;


-- ── 6 · Work out the month's pay ─────────────────────────────────────────────
--
-- HOW A DEDUCTION IS DECIDED
--   Only days the kitchen actually marked count. total_days is the number of
--   distinct dates with any attendance recorded that month -- not the calendar
--   length -- so a kitchen that marked attendance on nine days out of thirty
--   does not accidentally dock everybody twenty-one days' pay.
--
--   A half day counts 0.5. Absence on a marked day costs a proportional share
--   of salary. Mark nothing and nobody loses anything, which is the right
--   default for a feature somebody may be trying out for the first time.

create or replace function public.process_payroll(p_month text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bid   uuid := auth.uid();
  v_start date;
  v_end   date;
  v_total int;
  v_rows  int := 0;
begin
  if v_bid is null then
    raise exception 'sign in first';
  end if;
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'month must look like 2026-08';
  end if;

  v_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end   := (v_start + interval '1 month')::date;

  select count(distinct a.on_date) into v_total
    from public.attendance a
   where a.business_id = v_bid
     and a.on_date >= v_start and a.on_date < v_end;

  insert into public.payroll_runs (
    business_id, employee_id, month, employee_name,
    base_salary, days_present, total_days, deductions, net_salary
  )
  select v_bid,
         e.id,
         p_month,
         e.name,
         e.salary,
         d.present,
         v_total,
         case when v_total > 0
              then round(e.salary * (v_total - d.present) / v_total, 2)
              else 0 end,
         case when v_total > 0
              then round(e.salary * d.present / v_total, 2)
              else e.salary end
    from public.employees e
    cross join lateral (
      select coalesce(sum(case a.status when 'present' then 1
                                        when 'half'    then 0.5
                                        else 0 end), 0) as present
        from public.attendance a
       where a.business_id = v_bid
         and a.employee_id = e.id
         and a.on_date >= v_start and a.on_date < v_end
    ) d
   where e.business_id = v_bid
     and e.active
  on conflict (business_id, employee_id, month) do update
    set employee_name = excluded.employee_name,
        base_salary   = excluded.base_salary,
        days_present  = excluded.days_present,
        total_days    = excluded.total_days,
        deductions    = excluded.deductions,
        net_salary    = excluded.net_salary;

  get diagnostics v_rows = row_count;
  return jsonb_build_object('month', p_month, 'processed', v_rows, 'total_days', v_total);
end;
$fn$;

revoke all on function public.process_payroll(text) from public, anon;
grant execute on function public.process_payroll(text) to authenticated;


-- ── 7 · Which APK the app should be on ───────────────────────────────────────
-- The last thing in the app that still called the old server: a version check
-- that gates the force-update modal.
--
-- One row, and the app reads it before the user has signed in, so this is a
-- function rather than a table policy -- the same pattern every other public
-- read in this project uses. Leave min_version null and the gate stays shut,
-- which is the right default: an unconfigured check should never lock anybody
-- out of an app that works.

create table if not exists public.app_release (
  id             int primary key default 1,
  min_version    text,
  latest_version text,
  apk_url        text,
  release_notes  text,
  updated_at     timestamptz not null default now(),
  constraint app_release_single_row check (id = 1)
);

insert into public.app_release (id) values (1) on conflict (id) do nothing;

alter table public.app_release enable row level security;
-- No policy: the function below is the only way in, and it is the only one
-- needed. Writing is a job for the SQL editor, not the app.

create or replace function public.app_version()
returns jsonb
language sql
security definer
stable
set search_path = public
as $fn$
  select jsonb_build_object(
    'min_version',    r.min_version,
    'latest_version', r.latest_version,
    'apk_url',        r.apk_url,
    'release_notes',  r.release_notes
  )
  from public.app_release r where r.id = 1;
$fn$;

revoke all on function public.app_version() from public;
grant execute on function public.app_version() to anon, authenticated;
