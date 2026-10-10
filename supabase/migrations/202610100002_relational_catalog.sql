-- Run AFTER 202610100001_authenticated_workspace.sql. Additive upgrade: preserves existing records.
begin;
create table public.departments (
 id text primary key check(length(id) between 1 and 100),
 name text not null unique check(length(trim(name)) between 1 and 100)
);
insert into public.departments values ('water','Water Department'),('electricity','Electricity Department'),('roads','Roads & Highways'),('municipal','Municipal Corporation');
create table public.road_segments (
 id text primary key check(length(id) between 1 and 100),
 name text not null check(length(trim(name)) between 1 and 200),
 verified boolean not null default false,
 is_illustrative boolean not null default false,
 coordinates jsonb not null check(jsonb_typeof(coordinates)='array' and jsonb_array_length(coordinates)>=2)
);
alter table public.profiles add constraint profiles_department_fk foreign key(department) references public.departments(name);
alter table public.projects add column department_id text references public.departments(id), add column road_segment_id text references public.road_segments(id), add column is_illustrative boolean not null default false;
alter table public.complaints add column project_id text references public.projects(id) on delete set null;
create index projects_department_idx on public.projects(department_id);
create index projects_road_idx on public.projects(road_segment_id);
create index complaints_project_idx on public.complaints(project_id);
create table public.project_updates (
 project_id text not null references public.projects(id) on delete cascade,
 id text not null,
 department_id text not null references public.departments(id),
 occurred_at timestamptz not null,
 position integer not null,
 data jsonb not null,
 primary key(project_id,id),unique(project_id,position)
);
create table public.coordination_projects (
 coordination_id text not null references public.coordination(id) on delete cascade,
 project_id text not null references public.projects(id) on delete cascade,
 primary key(coordination_id,project_id)
);
create index coordination_projects_project_idx on public.coordination_projects(project_id);
-- Older versions only contained illustrative built-in segments. Backfill without asserting real verification.
insert into public.road_segments(id,name,verified,is_illustrative,coordinates)
select distinct on (data->>'roadId') data->>'roadId',data->>'roadName',false,true,
 jsonb_build_array(jsonb_build_array((data->>'lat')::numeric,(data->>'lng')::numeric),jsonb_build_array((data->>'lat')::numeric,(data->>'lng')::numeric))
from public.projects where coalesce(data->>'roadId','')<>'' order by data->>'roadId',id;
update public.projects p set department_id=d.id,road_segment_id=nullif(p.data->>'roadId',''),is_illustrative=coalesce((p.data->>'isIllustrative')::boolean,true),data=p.data || jsonb_build_object('isIllustrative',coalesce((p.data->>'isIllustrative')::boolean,true)) from public.departments d where d.name=p.data->>'department';
alter table public.projects alter column department_id set not null;
update public.complaints c set project_id=p.id from public.projects p where p.id=c.data->>'projectId';
insert into public.project_updates(project_id,id,department_id,occurred_at,position,data)
select p.id,u.value->>'id',p.department_id,(u.value->>'at')::timestamptz,u.ordinality::integer,u.value from public.projects p cross join lateral jsonb_array_elements(p.data->'updates') with ordinality u;
insert into public.coordination_projects select c.id,p.id from public.coordination c join public.projects p on p.id in (select jsonb_array_elements_text(c.data->'conflict'->'projectIds'));

-- Maintain relational keys and independent timeline rows in the SAME transaction as existing RPC writes.
create function public.link_civic_project() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select id into new.department_id from public.departments where name=new.data->>'department';
 if new.department_id is null then raise exception 'Unknown department'; end if;
 new.road_segment_id:=nullif(new.data->>'roadId','');
 if new.road_segment_id is not null and not exists(select 1 from public.road_segments where id=new.road_segment_id) then raise exception 'Unknown road segment'; end if;
 new.is_illustrative:=coalesce((new.data->>'isIllustrative')::boolean,false);
 new.data:=new.data || jsonb_build_object('isIllustrative',new.is_illustrative);
 return new;
end; $$;
create trigger projects_link before insert or update on public.projects for each row execute function public.link_civic_project();
create function public.sync_civic_project_updates() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.project_updates(project_id,id,department_id,occurred_at,position,data)
 select new.id,u.value->>'id',d.id,(u.value->>'at')::timestamptz,u.ordinality::integer,u.value
 from jsonb_array_elements(new.data->'updates') with ordinality u join public.departments d on d.name=u.value->>'department'
 on conflict(project_id,id) do nothing;
 return new;
end; $$;
create trigger project_updates_sync after insert or update on public.projects for each row execute function public.sync_civic_project_updates();
create function public.link_civic_complaint() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select id into new.project_id from public.projects where id=new.data->>'projectId';
 return new;
end; $$;
create trigger complaints_link before insert or update on public.complaints for each row execute function public.link_civic_complaint();
create function public.link_civic_coordination() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.coordination_projects where coordination_id=new.id;
 insert into public.coordination_projects select new.id,p.id from public.projects p where p.id in (select jsonb_array_elements_text(new.data->'conflict'->'projectIds'));
 return new;
end; $$;
create trigger coordination_link after insert or update on public.coordination for each row execute function public.link_civic_coordination();

alter table public.departments enable row level security;
alter table public.road_segments enable row level security;
alter table public.project_updates enable row level security;
alter table public.coordination_projects enable row level security;
create policy departments_read on public.departments for select to authenticated using(true);
create policy road_segments_read on public.road_segments for select to authenticated using(true);
create policy project_updates_read on public.project_updates for select to authenticated using(true);
create policy coordination_links_read on public.coordination_projects for select to authenticated using(public.civic_role() in ('City Administrator','Department Officer'));
revoke all on public.departments,public.road_segments,public.project_updates,public.coordination_projects from public,anon,authenticated;
grant select on public.departments,public.road_segments,public.project_updates,public.coordination_projects to authenticated;

-- Referential identity is now a catalog lookup, not a hardcoded department list.
alter table public.profiles drop constraint profiles_department_check;
create or replace function public.validate_civic_project(p jsonb) returns void language plpgsql set search_path='' as $$
declare field text; start_date date; end_date date;
begin
 if jsonb_typeof(p)<>'object' then raise exception 'Invalid project'; end if;
 foreach field in array array['id','name','department','contractor','authority','description','roadName','start','end','status','type'] loop
  if coalesce(length(trim(p->>field)),0)=0 or length(p->>field)>2000 then raise exception 'Invalid project field: %',field; end if;
 end loop;
 if not exists(select 1 from public.departments where name=p->>'department') or p->>'status' not in ('Planned','Ongoing','Delayed','Completed') or p->>'type' not in ('Pipeline','Underground cable','Road resurfacing','Drainage','Street lighting','Footpath') then raise exception 'Invalid project classification'; end if;
 if p->>'start' !~ '^\d{4}-\d{2}-\d{2}$' or p->>'end' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid project dates'; end if;
 start_date:=(p->>'start')::date;end_date:=(p->>'end')::date;
 if end_date<start_date then raise exception 'Completion precedes start'; end if;
 if jsonb_typeof(p->'lat') is distinct from 'number' or jsonb_typeof(p->'lng') is distinct from 'number' or abs((p->>'lat')::numeric)>90 or abs((p->>'lng')::numeric)>180 then raise exception 'Invalid coordinates'; end if;
 if jsonb_typeof(p->'progress') is distinct from 'number' or (p->>'progress')::numeric not between 0 and 100 or (p->>'status'='Completed' and (p->>'progress')::numeric<>100) then raise exception 'Invalid progress'; end if;
 if p->>'status'='Delayed' and coalesce(length(trim(p->>'delayReason')),0)=0 then raise exception 'Delay reason required'; end if;
 if jsonb_typeof(p->'excavation') is distinct from 'boolean' or jsonb_typeof(p->'updates') is distinct from 'array' then raise exception 'Invalid project history'; end if;
end; $$;

create function public.add_civic_catalog(kind text, record jsonb) returns void language plpgsql security definer set search_path='' as $$
declare point jsonb;
begin
 if auth.uid() is null or public.civic_role() is distinct from 'City Administrator' then raise exception 'Administrator access required'; end if;
 if jsonb_typeof(record) is distinct from 'object' then raise exception 'Invalid catalog record'; end if;
 if kind='department' then insert into public.departments(id,name) values(record->>'id',trim(record->>'name'));
 elsif kind='road' then
  if jsonb_typeof(record->'coordinates') is distinct from 'array' or jsonb_array_length(record->'coordinates')<2 or jsonb_array_length(record->'coordinates')>1000 then raise exception 'At least two road coordinates are required'; end if;
  for point in select value from jsonb_array_elements(record->'coordinates') loop
   if jsonb_typeof(point) is distinct from 'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number' or abs((point->>0)::numeric)>90 or abs((point->>1)::numeric)>180 then raise exception 'Invalid road coordinates'; end if;
  end loop;
  insert into public.road_segments values(record->>'id',trim(record->>'name'),coalesce((record->>'verified')::boolean,false),coalesce((record->>'isIllustrative')::boolean,false),record->'coordinates');
 else raise exception 'Invalid catalog kind'; end if;
end; $$;

-- A stable SECURITY INVOKER snapshot is one read transaction and obeys every table's RLS.
-- Returning a JSON object avoids silently truncating the portfolio at the REST row limit.
create function public.civic_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'version',1,
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.departments),'[]'::jsonb),
 'roads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'verified',verified,'isIllustrative',is_illustrative,'coordinates',coordinates) order by id) from public.road_segments),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(p.data || jsonb_build_object('updates',coalesce((select jsonb_agg(u.data order by u.position) from public.project_updates u where u.project_id=p.id),'[]'::jsonb)) order by p.id) from public.projects p),'[]'::jsonb),
 'complaints',coalesce((select jsonb_agg(data order by id) from public.complaints),'[]'::jsonb),
 'coordination',coalesce((select jsonb_object_agg(id,data) from public.coordination),'{}'::jsonb),
 'windowDays',(select (data->>'windowDays')::integer from public.settings where id='city')
) $$;
revoke all on function public.link_civic_project(),public.sync_civic_project_updates(),public.link_civic_complaint(),public.link_civic_coordination(),public.add_civic_catalog(text,jsonb),public.civic_snapshot() from public,anon,authenticated;
grant execute on function public.add_civic_catalog(text,jsonb),public.civic_snapshot() to authenticated;
comment on table public.project_updates is 'Transactional, append-only projection of server-stamped project events; clients cannot write directly.';
comment on column public.complaints.project_id is 'Nullable live relationship. Original project reference remains in the report payload after deletion.';
create function public.import_civic_demo(sample_projects jsonb, sample_roads jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; operations jsonb := '[]'::jsonb;
begin
 if auth.uid() is null or public.civic_role() is distinct from 'City Administrator' then raise exception 'Administrator access required'; end if;
 perform pg_advisory_xact_lock(714029);
 if exists(select 1 from public.projects) then raise exception 'Sample import requires an empty project register'; end if;
 if jsonb_typeof(sample_projects) is distinct from 'array' or jsonb_array_length(sample_projects)>20 or jsonb_typeof(sample_roads) is distinct from 'array' or jsonb_array_length(sample_roads)>20 then raise exception 'Invalid sample portfolio'; end if;
 for item in select value from jsonb_array_elements(sample_roads) loop
  -- Never reuse or overwrite a real road ID for an illustrative import.
  perform public.add_civic_catalog('road',item || '{"isIllustrative":true}'::jsonb);
 end loop;
 for item in select value from jsonb_array_elements(sample_projects) loop
  operations:=operations || jsonb_build_array(jsonb_build_object('kind','projects','id',item->>'id','before',null,'after',item || '{"isIllustrative":true}'::jsonb));
 end loop;
 perform public.civic_commit(operations);
end; $$;
revoke all on function public.import_civic_demo(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_civic_demo(jsonb,jsonb) to authenticated;
create or replace function public.civic_commit(operations jsonb) returns void language plpgsql security definer set search_path='' as $$
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
    -- Accept the optional public note, but never client timestamps or rewritten history.
    if jsonb_array_length(proposed->'updates')>jsonb_array_length(history) and coalesce(length(proposed->'updates'->-1->>'description'),0)>2000 then raise exception 'Project update too long'; end if;
    proposed:=jsonb_set(proposed,'{updates}',history || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'at',now(),'department',proposed->>'department','description',concat(case when current_data is null then 'Project announced.' else format('Project updated: %s%%; %s; schedule %s to %s (previously %s to %s). %s',proposed->>'progress',proposed->>'status',proposed->>'start',proposed->>'end',current_data->>'start',current_data->>'end',coalesce(proposed->>'delayReason','')) end,case when jsonb_array_length(proposed->'updates')>jsonb_array_length(history) then ' ' || (proposed->'updates'->-1->>'description') else '' end))));
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


notify pgrst, 'reload schema';
commit;
