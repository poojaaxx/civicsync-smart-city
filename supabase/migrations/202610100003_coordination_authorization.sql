-- Apply after migrations 001 and 002. Preserves all tables and existing data.
begin;
create or replace function public.civic_commit(operations jsonb) returns void language plpgsql security definer set search_path='' as $$
declare op jsonb; kind text; key text; previous jsonb; current_data jsonb; proposed jsonb; actor uuid; actor_role text; actor_department text; target_department text; owner uuid; history jsonb; old_status int; new_status int; pair_id text;
begin
 -- Read authorization after acquiring the same lock used by role assignments.
 perform pg_advisory_xact_lock(714029);
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
    -- Authorize the existing record as well as the proposed snapshot: callers must not take over an unrelated record.
    if current_data is not null and not exists(select 1 from public.projects p where p.id in (select jsonb_array_elements_text(current_data->'conflict'->'projectIds')) and p.data->>'department'=actor_department) then raise exception 'Coordination outside assigned department'; end if;
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
