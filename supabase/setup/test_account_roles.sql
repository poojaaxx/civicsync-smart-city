-- Run manually as the project owner in Supabase SQL Editor, after migrations 001 and 002.
-- Replace only the three email placeholders and, optionally, the department name.
-- This is an account setup operation, NOT a schema migration or browser RPC.
begin;
do $$
declare
 admin_email text := 'YOUR-ADMIN-EMAIL';
 officer_email text := 'YOUR-OFFICER-EMAIL';
 citizen_email text := 'YOUR-CITIZEN-EMAIL';
 officer_department text := 'Water Department';
 admin_id uuid;
 officer_id uuid;
 citizen_id uuid;
 changed integer;
begin
 perform pg_advisory_xact_lock(714029);
 if lower(trim(admin_email)) = lower(trim(officer_email))
    or lower(trim(admin_email)) = lower(trim(citizen_email))
    or lower(trim(officer_email)) = lower(trim(citizen_email)) then
  raise exception 'Use three different account emails';
 end if;
 if not exists(select 1 from public.departments where name=officer_department) then
  raise exception 'Choose an existing department name from public.departments';
 end if;
 select id into strict admin_id from auth.users
 where lower(email)=lower(trim(admin_email)) and email_confirmed_at is not null;
 select id into strict officer_id from auth.users
 where lower(email)=lower(trim(officer_email)) and email_confirmed_at is not null;
 select id into strict citizen_id from auth.users
 where lower(email)=lower(trim(citizen_email)) and email_confirmed_at is not null;
 -- Leave the Citizen account unchanged. Do not accidentally demote an existing staff account.
 if not exists(select 1 from public.profiles where id=citizen_id and role='Citizen' and department is null) then
  raise exception 'The citizen test account must already have Citizen access and no department';
 end if;
 update public.profiles set role='City Administrator',department=null where id=admin_id;
 get diagnostics changed = row_count;
 if changed<>1 then raise exception 'Administrator profile missing; check signup trigger and migrations'; end if;
 update public.profiles set role='Department Officer',department=officer_department where id=officer_id;
 get diagnostics changed = row_count;
 if changed<>1 then raise exception 'Officer profile missing; check signup trigger and migrations'; end if;
 raise notice 'Configured administrator and officer; citizen unchanged. Verify the profiles and sign in again.';
end;
$$;
commit;
