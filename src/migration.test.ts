// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { seedDatabase } from "./seed";
it("upgrades an existing authenticated workspace without losing projects, reports, history or coordination", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610100001_authenticated_workspace.sql",
        "utf8",
      ),
    );
    const owner = "00000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users values($1,$2,$3)", [
      owner,
      "owner@example.test",
      "{}",
    ]);
    const seed = seedDatabase();
    const project = { ...seed.projects[0] };
    delete project.isIllustrative;
    await db.query("insert into public.projects values($1,$2,now())", [
      project.id,
      JSON.stringify(project),
    ]);
    const report = { ...seed.complaints[0], projectId: project.id };
    await db.query("insert into public.complaints values($1,$2,$3,now())", [
      report.id,
      owner,
      JSON.stringify(report),
    ]);
    const coordination = {
      id: "CF:legacy",
      status: "Acknowledged",
      notes: [{ text: "Preserve this decision" }],
      conflict: { projectIds: [project.id, "deleted-project"] },
    };
    await db.query("insert into public.coordination values($1,$2)", [
      coordination.id,
      JSON.stringify(coordination),
    ]);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610100002_relational_catalog.sql",
        "utf8",
      ),
    );
    const saved = (
      await db.query<{ data: typeof project }>(
        "select data from public.projects",
      )
    ).rows[0].data;
    expect(saved).toMatchObject(project);
    expect(
      (await db.query<{ data: unknown }>("select data from public.complaints"))
        .rows[0].data,
    ).toEqual(report);
    expect(
      (
        await db.query<{ data: unknown }>(
          "select data from public.coordination",
        )
      ).rows[0].data,
    ).toEqual(coordination);
    expect(
      (await db.query("select * from public.project_updates")).rows,
    ).toHaveLength(project.updates.length);
    expect(
      (await db.query("select * from public.coordination_projects")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select verified,is_illustrative from public.road_segments",
        )
      ).rows[0],
    ).toEqual({ verified: false, is_illustrative: true });
    await db.query("delete from public.projects where id=$1", [project.id]);
    expect(
      (
        await db.query<{ project_id: string | null }>(
          "select project_id from public.complaints",
        )
      ).rows[0].project_id,
    ).toBeNull();
    expect(
      (
        await db.query<{ data: unknown }>(
          "select data from public.coordination",
        )
      ).rows[0].data,
    ).toEqual(coordination);
    expect(
      (await db.query("select * from public.coordination_projects")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 30000);
