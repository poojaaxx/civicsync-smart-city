# Enable real CivicSync accounts with Supabase

The client integration is implemented. Your local project URL and public key can remain as configured. Hosted data access requires both migrations below; email delivery and multi-account behavior must then be verified in your tenant. No credentials belong in this document.

## 1. Create your Supabase project

Sign in to https://supabase.com/dashboard and create a project in your own account. Keep its database password private. Wait for provisioning to complete.

In **Settings → API Keys / Connect**, copy the **Project URL** and **public publishable key**. The publishable key normally starts with `sb_publishable_`. It is designed for browser clients protected by RLS. Never use the secret key (`sb_secret_...`), legacy service-role key, or database password in frontend environment variables.

## 2. Apply the database migrations

Open the project's **SQL Editor** and run each complete file in this order, as separate queries:

1. `supabase/migrations/202610100001_authenticated_workspace.sql`
2. `supabase/migrations/202610100002_relational_catalog.sql`

Run each once. If migration 001 was already applied, run only 002. Migration 001 creates profiles, projects, complaints, coordination, settings, signup triggers, row-level read policies and validated write functions inside a transaction. It also creates citizen profiles for any users already registered. This is an initial migration for a new CivicSync database; do not rerun it blindly against an already initialized schema.

Migration 002 adds departments, road segments, project updates and coordination-project relationships, catalog administration, optional sample import, and an RLS-protected workspace snapshot. It preserves existing projects, reports and coordination records. Legacy road IDs are retained as unverified illustrative geometry; confirm their coordinates before operational use. Both scripts are transactional: a failure rolls back that script. Do not drop tables or rerun successful migrations to fix a later failure.

After running them, verify in SQL Editor:

```sql
select to_regclass('public.profiles'), to_regclass('public.projects'),
       to_regclass('public.departments'), to_regclass('public.road_segments'),
       to_regclass('public.complaints'), to_regclass('public.project_updates'),
       to_regclass('public.coordination'), to_regclass('public.coordination_projects');
select to_regprocedure('public.civic_snapshot()');
```

Every result must be non-null. The shared project register starts empty with four starter department names and no roads. Local demo data is never uploaded automatically.

## 3. Configure authentication

In **Authentication → Providers**, enable Email/Password and keep email confirmation enabled. Configure a minimum password length of at least 12 characters to match signup validation.

In **Authentication → URL Configuration**, set:

- Site URL: your deployed HTTPS CivicSync URL, once deployed.
- Allowed redirect URLs for local testing: `http://127.0.0.1:5173`, `http://127.0.0.1:5173/auth/reset`.
- If using localhost, separately add `http://localhost:5173` and `http://localhost:5173/auth/reset`.
- For deployed use, add the exact production origin and `https://YOUR-DOMAIN/auth/reset`.

Restrict production redirects to domains you control. Signup confirmation returns to the current origin; password reset returns to `/auth/reset`.

Supabase's built-in mail service has development restrictions and rate limits. Configure your own SMTP provider in the Supabase dashboard for public signups; until then, email delivery may only work for authorized addresses. Set SMTP credentials **only in Supabase**, never in CivicSync or GitHub. Enable appropriate Auth rate limits and abuse protection for your launch.

## 4. Configure the local application

Copy `.env.example` to `.env.local` and fill it locally:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-PUBLISHABLE-KEY
```

`VITE_SUPABASE_ANON_KEY` is also accepted as an alias for the public key variable, including when it contains a modern publishable key. Your local configuration can keep that existing name.

Restart `npm run dev`. The login screen now enables real account actions and removes the local demo entry. Never paste passwords or secret keys into chat. `.env.local` is ignored by Git.

Without configuration, the login screen clearly reports setup is pending. Its account actions are disabled. **Explore local demo** is an explicit, isolated fallback available only without backend configuration; it is not a login bypass for the shared database.

For a complete three-account setup with exact SQL, use [Three-account role setup and verification](#three-account-role-setup-and-verification) below.

## 5. Create the first administrator

Use CivicSync's **Create an account**, confirm your email, then sign in. Registration always creates a Citizen; role values in signup metadata are ignored.

In your trusted Supabase SQL Editor, replace the email below with your own confirmed account email and run:

```sql
update public.profiles p
set role = 'City Administrator', department = null
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR-CONFIRMED-EMAIL')
  and u.email_confirmed_at is not null
returning p.id, p.role;
```

Verify exactly one row was returned. Refresh CivicSync or sign out and back in. No administrator password is hardcoded.

## 6. Add officers and citizens

Citizens register and confirm their own email. To create an officer:

1. Ask the person to register and confirm their account.
2. As an administrator, open **Accounts**.
3. Enter their registered email, select Department Officer, and choose a department.
4. Assign access; they refresh/sign in again.

Administrators can assign Citizen or City Administrator access in the same screen. You cannot change your own role there. Only the administrator-only SQL function can assign roles; direct client profile writes are blocked.

## 7. Populate and test the shared workspace

Open **Accounts > Shared department & road catalog** to add your actual departments and road segments. The road form stores start/end coordinates; only mark verified when you have checked the segment identity. You may also create a project at custom coordinates without a catalog road, which produces uncertain location matching. Create actual project records through **Projects > New project**. Alternatively, on an empty workspace, **Accounts → Import illustrative projects** imports the ten explicitly fictional sample projects and six illustrative road segments in one transaction. Sample complaints and local user data are not imported.

Use two separate browser profiles to verify:

- Citizen A signs up, confirms email, submits a report, signs out, and can retrieve it after signing back in.
- Citizen B cannot see or track A's report, even with the reference ID.
- An officer can edit only their assigned department's projects and see/update complaints linked to those projects. Unlinked reports are administrator-managed.
- An officer cannot delete projects, change the coordination window, or promote accounts.
- The administrator can update reports, assign access, and manage all projects.
- Reports advance one step at a time. User-submitted content cannot be rewritten during a status update.
- A stale editor receives a conflict error instead of overwriting another user's saved changes. Use **Refresh data** before retrying.
- Sign out removes the private interface; protected links require authentication again.
- Password reset email returns to the new-password screen and the new password works.

## 8. Deploy

Set the same two public environment variables in Vercel's project settings, then redeploy. Build command: `npm run build`; output: `dist`. Supabase policies enforce authorization independently of the frontend bundle. Update the auth redirect allowlist to match the actual deployed URL.

## Security and operational boundaries

- Supabase Auth handles password hashing, email confirmation, sessions and password recovery. CivicSync never stores plaintext passwords.
- Access roles are stored in `profiles`, writable only through a guarded administrator function or trusted database administration.
- Reads use RLS. Browser roles have SELECT permissions only; writes go through `civic_commit`, which validates authentication, assignment, payloads and prior record versions.
- The transaction rejects stale writes and rolls back a batch if any operation is unauthorized or invalid.
- Citizen report ownership is assigned from `auth.uid()` by the server. Private reports are never loaded into another citizen's application state.
- Report images currently live in their protected database row as bounded data URLs (1 MB upload limit). This is functional for small deployments; move to private object storage with signed URLs as volume grows.
- Shared data refreshes after successful writes and through **Refresh data** / reload; there is no realtime subscription yet.
- Connected maps and conflict checks read road segments from Supabase. Optional sample geometry is labeled illustrative. The catalog form adds segments; editing/importing detailed GIS geometry requires trusted database administration for now.
- Account data and browser sessions require the usual deployment security practices, including HTTPS, XSS prevention, appropriate content policies, backups and retention decisions.

## Verification performed without your credentials

Local tests execute both actual migrations in embedded PostgreSQL (PGlite), verify RLS, role escalation denial, report privacy, department restrictions, stale-write handling, rollback, server validation, relational links, adapter CRUD, stored-road conflict detection, optional sample import and public timeline notes. UI tests mock the auth provider to verify requests and errors. Browser tests exercise unconfigured login and the explicit local demo.

These tests **do not claim that a live Supabase tenant, SMTP provider, confirmation email, or reset email has been configured or tested**. Complete the live two-account checklist above after setup.

Implementation references: [Supabase React authentication](https://supabase.com/docs/guides/auth/quickstarts/react), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database functions](https://supabase.com/docs/guides/database/functions).

## Three-account role setup and verification

This procedure uses the existing authorization architecture. It does not create accounts, change passwords, recreate tables or remove records. Run migrations 001 and 002 first. No additional migration is needed for these roles.

### Register and identify your accounts

Create three separate accounts through CivicSync and confirm each email: one citizen, one intended officer and one intended administrator. Use separate browser profiles (not three tabs sharing the same session). All three must initially receive Citizen access. Keep a fourth Citizen account if you want to test citizen-to-citizen report isolation independently.

In the trusted Supabase SQL Editor, inspect only your test accounts. Replace the placeholders locally:

```sql
select u.id, u.email, u.email_confirmed_at, p.role, p.department
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (
  lower('YOUR-ADMIN-EMAIL'),
  lower('YOUR-OFFICER-EMAIL'),
  lower('YOUR-CITIZEN-EMAIL')
)
order by u.email;

select id, name from public.departments order by name;
```

Expect exactly three accounts, non-null confirmation dates, and a profile for each. `profiles.department` stores the department **name**, not its ID. Copy an exact name from the second query. Do not change `auth.users.role`: Supabase's API role and CivicSync's application role are different things. Do not put CivicSync roles into user metadata.

### Assign your test roles securely

Recommended: open [supabase/setup/test_account_roles.sql](supabase/setup/test_account_roles.sql), replace its three email placeholders and optionally `Water Department`, then run the entire script in Supabase SQL Editor as the project owner. This is a manual setup script, not a migration. It checks distinct emails, confirmed accounts, an existing department, and affected profile counts; both promotions happen in one transaction. The Citizen profile remains unchanged. On an error, no promotion is committed. If the editor reports an aborted transaction, run `rollback;`, correct the inputs and retry.

For individual, targeted promotions, the equivalent commands using the actual schema are below. Execute only the statement for the intended account, in the trusted SQL Editor:

```sql
-- Bootstrap your confirmed administrator account.
update public.profiles p
set role = 'City Administrator', department = null
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR-ADMIN-EMAIL')
  and u.email_confirmed_at is not null
returning p.id, p.role, p.department;

-- Assign your confirmed officer to an existing department NAME.
update public.profiles p
set role = 'Department Officer', department = d.name
from auth.users u, public.departments d
where p.id = u.id
  and lower(u.email) = lower('YOUR-OFFICER-EMAIL')
  and u.email_confirmed_at is not null
  and d.name = 'Water Department'
returning p.id, p.role, p.department;
```

Each individual statement must return exactly one row. Zero rows means a missing/unconfirmed email, missing profile or unmatched department; it does not indicate success. Rerun the inspection query and verify the three final assignments. Sign out and back in on each browser profile to refresh the UI identity.

After bootstrapping, use **Accounts > Assign account access** while signed in as the administrator for routine assignments. It calls the existing `public.assign_civic_role(account_email, assigned_role, assigned_department)` RPC. That function checks `auth.uid()` and the caller's database profile before writing; it blocks changing your own access. Its current target lookup requires an existing registered account; the setup script additionally requires email confirmation. The database foreign key and officer non-null check reject nonexistent or missing departments. Citizen and officer callers cannot use the RPC to elevate themselves or anyone else.

Do not call this RPC without an authenticated application session and expect the SQL Editor to count as an application administrator: the SQL Editor normally has no end-user `auth.uid()`. The direct SQL above is deliberately a trusted project-owner operation. Never add a service-role key to the browser to make role assignment work.

### Expected access matrix

| Operation                                            | Citizen | Department Officer                                       | City Administrator     |
| ---------------------------------------------------- | ------- | -------------------------------------------------------- | ---------------------- |
| Browse projects, maps, catalogs and public timelines | Yes     | Yes, all departments                                     | Yes                    |
| Submit and track own reports                         | Yes     | Yes                                                      | Yes                    |
| Read other people's reports                          | No      | Only linked to own department's projects                 | All                    |
| Create/edit projects                                 | No      | Own department only                                      | All departments        |
| Delete projects                                      | No      | No                                                       | Yes                    |
| Advance complaint status                             | No      | Linked to own department's projects                      | All reports            |
| Read stored coordination notes/reviews               | No      | Yes, across departments for coordination                 | Yes                    |
| Write coordination notes/reviews                     | No      | Only where an involved project belongs to own department | Yes                    |
| Change city coordination window                      | No      | No                                                       | Yes                    |
| Add roads/departments, import samples, assign roles  | No      | No                                                       | Yes                    |
| Direct browser table writes, including own profile   | No      | No                                                       | No; use validated RPCs |

All authenticated roles may see computed conflict alerts derived from readable projects. Citizen accounts do not receive staff coordination records. Officer access to other departments' public projects and staff coordination records is intentional; officer **mutations** are department-scoped. Report counts and exports reflect only the rows the current account may read. No role can delete complaints through the application or rewrite submitted complaint content.

### Live verification with separate sessions

1. As Administrator, create two explicitly labeled test projects, one in the officer's assigned department and one in another department. Create new test records; do not modify production projects for testing. Confirm Accounts is accessible, and that both projects can be edited. Use Accounts to assign the officer's department if you did not use SQL.
2. As Citizen, confirm the role label and citizen landing page. Browse both projects. Submit one report against each and one unlinked report. Record their references. Reload and confirm all three persist. Try `/accounts` and `/projects/new` directly: they must show an access restriction. Citizen report status controls must be absent.
3. As Officer, verify the assigned department's project can be edited. Open the other project's edit URL directly: it must refuse editing. Project deletion, Accounts and coordination-window changes must be unavailable. Of the citizen's three reports, only the report linked to this officer's department should be visible. Advance it from Submitted to Under Review; the citizen sees the change after Refresh data/reload. Officer-owned reports remain readable by the officer, but ownership alone does not authorize staff status updates on unrelated projects.
4. As Administrator, confirm all three reports are visible; advance the unlinked report one step. Verify project deletion on a disposable test project only, and assign/revoke officer access through Accounts. Sign in again as the changed account and confirm its new permissions. A revoked officer must no longer be able to save staff changes, even if an old browser screen still shows a button.
5. With a second Citizen account, confirm none of the first citizen's reports can be found, including by copied reference. Sign out and confirm protected URLs require login again. Also verify email confirmation and password recovery on your actual hosted project.

Frontend hiding alone is not a permission test. The automated PostgreSQL tests call restricted RPCs and direct table writes as unprivileged database users. For a safe hosted check of self-promotion protection, run this **as project owner in SQL Editor**, substituting the Citizen UUID from the inspection query. Every change is rolled back, even if a protection is missing:

```sql
begin;
select set_config('request.jwt.claim.sub', 'YOUR-CITIZEN-UUID', true);
set local role authenticated;
select auth.uid(), public.civic_role(), public.civic_department();
-- Expected: your citizen UUID, Citizen, null.
update public.profiles
set role = 'City Administrator'
where id = auth.uid();
-- Expected: permission denied. The transaction is now aborted.
rollback;
```

Run the `rollback;` separately if your editor stops at the expected error. The displayed role must be Citizen before interpreting the denial. To check the RPC separately:

```sql
begin;
select set_config('request.jwt.claim.sub', 'YOUR-CITIZEN-UUID', true);
set local role authenticated;
select public.assign_civic_role('YOUR-CITIZEN-EMAIL', 'City Administrator', null);
-- Expected: Administrator access required.
rollback;
```

Repeat with the Officer UUID/email; it must also be denied. These SQL-only checks simulate authenticated database claims under the project owner's control. They do not log a user into the application and do not replace real browser-session tests. Do not run permission tests as the default SQL Editor owner without `set local role authenticated`, since the owner bypasses ordinary client restrictions.

### Why public signup cannot promote a user

The signup trigger inserts only `id` and `display_name`; `profiles.role` defaults to Citizen and `department` remains null. Submitted metadata is not used for authorization. Profile writes are revoked from browser roles, and RLS limits profile reads. All application role assignments require the database administrator check in `assign_civic_role`; project, complaint, coordination and settings writes independently recheck their permissions in `civic_commit`. This follows Supabase's guidance that [user-editable metadata must not be trusted for authorization](https://supabase.com/docs/guides/database/postgres/row-level-security).

Local verification exercises the actual migration SQL in PostgreSQL/PGlite, including malicious signup role claims, direct writes, self-promotion attempts, invalid officer departments, staff mutation scope and complaint privacy. Test accounts in automated fixtures exist only in the disposable test database. No real account has been promoted by these tests. Hosted setup is complete only after the inspection query and separate-account checklist pass in your own Supabase project.
