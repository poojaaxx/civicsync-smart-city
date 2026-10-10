-- CivicSync authenticated backend. Run once in the Supabase SQL editor.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 role text not null default 'Citizen' check(role in ('Citizen','Department Officer','City Administrator')),
 department text check(department in ('Water Department','Electricity Department','Roads & Highways','Municipal Corporation')),
 check(role <> 'Department Officer' or department is not null)
);
create function public.create_civic_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
 return new;
end; $$;
create trigger civic_profile_on_signup after insert on auth.users for each row execute function public.create_civic_profile();
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data->>'display_name',''),100) from auth.users on conflict do nothing;
create function public.civic_role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=(select auth.uid()) $$;
create function public.civic_department() returns text language sql stable security definer set search_path='' as $$ select department from public.profiles where id=(select auth.uid()) $$;
create table public.projects (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table public.complaints (id text primary key, owner_id uuid not null references auth.users(id), data jsonb not null, updated_at timestamptz not null default now());
create index complaints_owner_idx on public.complaints(owner_id);
create table public.coordination (id text primary key, data jsonb not null);
create table public.settings (id text primary key check(id='city'), data jsonb not null);
insert into public.settings values('city','{"windowDays":7}');
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.complaints enable row level security;
alter table public.coordination enable row level security;
alter table public.settings enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.civic_role()='City Administrator');
create policy projects_read on public.projects for select to authenticated using(true);
create policy complaints_read on public.complaints for select to authenticated using(owner_id=(select auth.uid()) or public.civic_role()='City Administrator' or (public.civic_role()='Department Officer' and exists(select 1 from public.projects p where p.id=complaints.data->>'projectId' and p.data->>'department'=public.civic_department())));
create policy coordination_read on public.coordination for select to authenticated using(public.civic_role() in ('Department Officer','City Administrator'));
create policy settings_read on public.settings for select to authenticated using(true);
-- Direct writes are forbidden. Validated transactional RPCs are the only write path.
revoke all on public.profiles,public.projects,public.complaints,public.coordination,public.settings from anon,authenticated;
grant select on public.profiles,public.projects,public.complaints,public.coordination,public.settings to authenticated;

create function public.validate_civic_project(p jsonb) returns void language plpgsql set search_path='' as $$
declare field text; start_date date; end_date date;
begin
 if jsonb_typeof(p)<>'object' then raise exception 'Invalid project'; end if;
 foreach field in array array['id','name','department','contractor','authority','description','roadName','start','end','status','type'] loop
  if coalesce(length(trim(p->>field)),0)=0 or length(p->>field)>2000 then raise exception 'Invalid project field: %',field; end if;
 end loop;
 if p->>'department' not in ('Water Department','Electricity Department','Roads & Highways','Municipal Corporation') or p->>'status' not in ('Planned','Ongoing','Delayed','Completed') or p->>'type' not in ('Pipeline','Underground cable','Road resurfacing','Drainage','Street lighting','Footpath') then raise exception 'Invalid project classification'; end if;
 if p->>'start' !~ '^\d{4}-\d{2}-\d{2}$' or p->>'end' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid project dates'; end if;
 start_date:=(p->>'start')::date; end_date:=(p->>'end')::date;
 if end_date<start_date then raise exception 'Completion precedes start'; end if;
 if jsonb_typeof(p->'lat') is distinct from 'number' or jsonb_typeof(p->'lng') is distinct from 'number' or abs((p->>'lat')::numeric)>90 or abs((p->>'lng')::numeric)>180 then raise exception 'Invalid coordinates'; end if;
 if jsonb_typeof(p->'progress') is distinct from 'number' or (p->>'progress')::numeric not between 0 and 100 or (p->>'status'='Completed' and (p->>'progress')::numeric<>100) then raise exception 'Invalid progress'; end if;
 if p->>'status'='Delayed' and coalesce(length(trim(p->>'delayReason')),0)=0 then raise exception 'Delay reason required'; end if;
 if jsonb_typeof(p->'excavation') is distinct from 'boolean' or jsonb_typeof(p->'updates') is distinct from 'array' then raise exception 'Invalid project history'; end if;
end; $$;

create function public.civic_commit(operations jsonb) returns void language plpgsql security definer set search_path='' as $$
declare op jsonb; kind text; key text; previous jsonb; current_data jsonb; proposed jsonb; actor uuid; actor_role text; actor_department text; target_department text; owner uuid; history jsonb; old_status int; new_status int; pair_id text;
begin
 actor:=auth.uid(); actor_role:=public.civic_role(); actor_department:=public.civic_department();
 if actor is null or actor_role is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(operations) is distinct from 'array' or jsonb_array_length(operations)>200 then raise exception 'Invalid operations'; end if;
 -- Serialize mutations and compare previous payloads to reject stale writes atomically.
 perform pg_advisory_xact_lock(714029);
 for op in select value from jsonb_array_elements(operations) loop
  kind:=op->>'kind'; key:=op->>'id'; proposed:=nullif(op->'after','null'::jsonb); previous:=nullif(op->'before','null'::jsonb); current_data:=null;
  if (proposed is not null and jsonb_typeof(proposed)<>'object') or octet_length(op::text)>2000000 then raise exception 'Invalid record payload'; end if;
  if key is null or length(key)>200 then raise exception 'Invalid record ID'; end if;
  if kind='projects' then select data into current_data from public.projects where id=key;
  elsif kind='complaints' then select data,owner_id into current_data,owner from public.complaints where id=key;
  elsif kind='coordination' then select data into current_data from public.coordination where id=key;
  elsif kind='settings' then select data into current_data from public.settings where id=key;
  else raise exception 'Invalid record type'; end if;
  if kind='projects' then
   if actor_role not in ('City Administrator','Department Officer') then raise exception 'Project write forbidden'; end if;
   if actor_role='Department Officer' and (proposed is null or (current_data is not null and current_data->>'department' is distinct from actor_department) or proposed->>'department' is distinct from actor_department) then raise exception 'Project outside assigned department'; end if;
   if proposed is not null then
    perform public.validate_civic_project(proposed);
    if proposed->>'id' is distinct from key then raise exception 'Project ID mismatch'; end if;
    -- Preserve all earlier public history; server stamps the new event.
    history:=coalesce(current_data->'updates','[]'::jsonb);
    proposed:=jsonb_set(proposed,'{updates}',history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'at',now(),'department',proposed->>'department','description',case when current_data is null then 'Project announced.' else format('Project updated: %s%%; %s; schedule %s to %s (previously %s to %s). %s',proposed->>'progress',proposed->>'status',proposed->>'start',proposed->>'end',current_data->>'start',current_data->>'end',coalesce(proposed->>'delayReason','')) end)));
   end if;
  elsif kind='complaints' then
   if proposed is null then raise exception 'Report deletion forbidden'; end if;
   if current_data is null then
    if proposed->>'id' is distinct from key or proposed->>'status' is distinct from 'Submitted' or coalesce(length(trim(proposed->>'description')),0) not between 10 and 2000 or coalesce(length(trim(proposed->>'location')),0) not between 3 and 200 then raise exception 'Invalid report'; end if;
    if coalesce(proposed->>'category','') not in ('Pothole','Road damage','Unfinished construction','Unsafe excavation','Water leakage','Construction debris','Other') then raise exception 'Invalid report category'; end if;
    if coalesce(proposed->>'projectId','')<>'' and not exists(select 1 from public.projects where id=proposed->>'projectId') then raise exception 'Unknown project'; end if;
    if proposed ? 'photo' and (length(proposed->>'photo')>1400000 or proposed->>'photo' !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Invalid report photograph'; end if;
    owner:=actor;
    proposed:=proposed || jsonb_build_object('createdAt',now(),'updates',jsonb_build_array(jsonb_build_object('at',now(),'status','Submitted')));
   else
    select data->>'department' into target_department from public.projects where id=current_data->>'projectId';
    if actor_role<>'City Administrator' and not(actor_role='Department Officer' and target_department is not null and target_department=actor_department) then raise exception 'Report update forbidden'; end if;
    if (proposed-'status'-'updates') is distinct from (current_data-'status'-'updates') then raise exception 'Report content is immutable'; end if;
    old_status:=array_position(array['Submitted','Under Review','In Progress','Resolved'],current_data->>'status');
    new_status:=array_position(array['Submitted','Under Review','In Progress','Resolved'],proposed->>'status');
    if new_status is null or new_status<>old_status+1 then raise exception 'Reports must advance one status at a time'; end if;
    proposed:=jsonb_set(proposed,'{updates}',(current_data->'updates') || jsonb_build_array(jsonb_build_object('at',now(),'status',proposed->>'status')));
   end if;
  elsif kind='coordination' then
   if actor_role not in ('City Administrator','Department Officer') or proposed is null then raise exception 'Coordination write forbidden'; end if;
   if proposed->>'id' is distinct from key or coalesce(proposed->>'status','') not in ('Detected','Under review','Acknowledged') or jsonb_typeof(proposed->'notes') is distinct from 'array' then raise exception 'Invalid coordination record'; end if;
   if actor_role='Department Officer' then
    if not exists(select 1 from public.projects p where p.id in (select jsonb_array_elements_text(proposed->'conflict'->'projectIds')) and p.data->>'department'=actor_department) then raise exception 'Coordination outside assigned department'; end if;
   end if;
   history:=coalesce(current_data->'notes','[]'::jsonb);
   if jsonb_array_length(proposed->'notes')>jsonb_array_length(history) then
    if length(proposed->'notes'->-1->>'text')>1500 then raise exception 'Note too long'; end if;
    history:=history || jsonb_build_array(jsonb_build_object('text',proposed->'notes'->-1->>'text','at',now(),'author',actor_role));
   end if;
   proposed:=jsonb_set(proposed,'{notes}',history);
  elsif kind='settings' then
   if actor_role<>'City Administrator' or key<>'city' or proposed is null or coalesce((proposed->>'windowDays')::int,-1) not in (0,3,7,14,30) then raise exception 'Settings write forbidden'; end if;
  end if;
  if current_data is distinct from previous then raise exception 'This record changed. Refresh the workspace before trying again.'; end if;
  if kind='projects' then
   if proposed is null then delete from public.projects where id=key;
   else insert into public.projects(id,data) values(key,proposed) on conflict(id) do update set data=excluded.data,updated_at=now(); end if;
  elsif kind='complaints' then insert into public.complaints(id,owner_id,data) values(key,owner,proposed) on conflict(id) do update set data=excluded.data,updated_at=now();
  elsif kind='coordination' then insert into public.coordination(id,data) values(key,proposed) on conflict(id) do update set data=excluded.data;
  elsif kind='settings' then update public.settings set data=proposed where id=key;
  end if;
 end loop;
end; $$;

create function public.assign_civic_role(account_email text, assigned_role text, assigned_department text default null) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform pg_advisory_xact_lock(714029);
 if auth.uid() is null or public.civic_role() is distinct from 'City Administrator' then raise exception 'Administrator access required'; end if;
 select id into target from auth.users where lower(email)=lower(trim(account_email));
 if target is null then raise exception 'Ask this person to register first.'; end if;
 if target=auth.uid() then raise exception 'You cannot change your own access.'; end if;
 if assigned_role not in ('Citizen','Department Officer','City Administrator') then raise exception 'Invalid role'; end if;
 update public.profiles set role=assigned_role,department=case when assigned_role='Department Officer' then assigned_department else null end where id=target;
end; $$;
revoke all on function public.create_civic_profile(),public.civic_role(),public.civic_department(),public.validate_civic_project(jsonb),public.civic_commit(jsonb),public.assign_civic_role(text,text,text) from public,anon,authenticated;
grant execute on function public.civic_role(),public.civic_department(),public.civic_commit(jsonb),public.assign_civic_role(text,text,text) to authenticated;
commit;
