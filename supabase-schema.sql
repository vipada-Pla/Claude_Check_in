-- ===== Claude Check-in · Supabase schema (v2.0.0) =====
-- วางใน Supabase → SQL Editor → Run (ครั้งเดียว)

create table if not exists public.admins (email text primary key);
insert into public.admins values ('vipada@foodlenoodle.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt()->>'email','')));
$$;

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  class_name text not null default 'Claude AI Class',
  start_time text not null default '09:00',
  grace int not null default 15,
  updated_at timestamptz default now()
);
insert into public.settings (id, class_name, start_time, grace) values (1, 'Claude AI', '09:00', 15) on conflict do nothing;

create table if not exists public.roster (
  id text primary key default gen_random_uuid()::text,
  no int,
  name text not null,
  name_en text default '',
  dept text default '',
  org text default '',
  phone text default '',
  email text default '',
  note text default '',
  created_at timestamptz default now()
);

create table if not exists public.checkins (
  id bigint generated always as identity primary key,
  date date not null,
  roster_id text not null,
  name text not null,
  dept text default '',
  org text default '',
  time timestamptz not null default now(),
  has_sig boolean default false,
  unique (date, roster_id)
);

create table if not exists public.signatures (
  date date not null,
  roster_id text not null,
  data_url text not null,
  primary key (date, roster_id)
);

alter table public.admins     enable row level security;
alter table public.settings   enable row level security;
alter table public.roster     enable row level security;
alter table public.checkins   enable row level security;
alter table public.signatures enable row level security;

create policy admins_read   on public.admins   for select to authenticated using (public.is_admin());
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy roster_read on public.roster for select to anon, authenticated using (true);
create policy roster_ins  on public.roster for insert to authenticated with check (public.is_admin());
create policy roster_upd  on public.roster for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy roster_del  on public.roster for delete to authenticated using (public.is_admin());
-- คนทั่วไป (รวมถึงบัญชีที่ล็อกอินแต่ไม่ใช่ผู้ดูแล) เห็นแค่ชื่อ/หน่วยงาน ไม่เห็นเบอร์โทร/อีเมล
revoke select on public.roster from anon, authenticated;
grant select (id, no, name, name_en, dept, org) on public.roster to anon, authenticated;

-- ผู้ดูแลดึงรายชื่อแบบครบทุกคอลัมน์ผ่านฟังก์ชันนี้
create or replace function public.admin_roster() returns setof public.roster
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  return query select * from public.roster order by no nulls last, name;
end $$;

create policy checkins_read on public.checkins for select to anon, authenticated using (true);
create policy checkins_del  on public.checkins for delete to authenticated using (public.is_admin());
revoke insert, update on public.checkins from anon, authenticated;

-- ลายเซ็น: เฉพาะผู้ดูแลเท่านั้นที่ดูได้
create policy sig_read on public.signatures for select to authenticated using (public.is_admin());
create policy sig_del  on public.signatures for delete to authenticated using (public.is_admin());
revoke insert, update on public.signatures from anon, authenticated;

-- เช็คชื่อ: ใช้เวลาจากเซิร์ฟเวอร์ และเช็คได้เฉพาะ "วันนี้" (ผู้ดูแลเลือกวันอื่นได้)
create or replace function public.check_in(p_roster_id text, p_date date, p_signature text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.roster;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  c public.checkins;
begin
  if p_date is null then p_date := today; end if;
  if p_date <> today and not public.is_admin() then
    raise exception 'wrong_date' using errcode = 'P0001';
  end if;
  if p_signature is null or length(p_signature) > 300000 or left(p_signature, 22) <> 'data:image/png;base64,' then
    raise exception 'bad_signature' using errcode = 'P0001';
  end if;
  select * into r from public.roster where id = p_roster_id;
  if not found then raise exception 'not_in_roster' using errcode = 'P0001'; end if;
  select * into c from public.checkins where date = p_date and roster_id = p_roster_id;
  if found then return json_build_object('existing', true, 'time', c.time); end if;
  insert into public.checkins(date, roster_id, name, dept, org, has_sig)
    values (p_date, r.id, r.name, coalesce(r.dept,''), coalesce(r.org,''), true) returning * into c;
  insert into public.signatures(date, roster_id, data_url) values (p_date, r.id, p_signature) on conflict do nothing;
  return json_build_object('existing', false, 'time', c.time);
end $$;

create or replace function public.reset_day(p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  delete from public.signatures where date = p_date;
  delete from public.checkins where date = p_date;
end $$;

create or replace function public.undo_checkin(p_date date, p_roster_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  delete from public.signatures where date = p_date and roster_id = p_roster_id;
  delete from public.checkins where date = p_date and roster_id = p_roster_id;
end $$;

revoke all on function public.check_in(text, date, text) from public;
revoke all on function public.reset_day(date) from public;
revoke all on function public.undo_checkin(date, text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.admin_roster() from public;
revoke execute on function public.admin_roster(), public.reset_day(date), public.undo_checkin(date, text) from anon;
grant execute on function public.admin_roster() to authenticated;
grant execute on function public.check_in(text, date, text) to anon, authenticated;
grant execute on function public.reset_day(date) to authenticated;
grant execute on function public.undo_checkin(date, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter publication supabase_realtime add table public.checkins, public.roster, public.settings;
