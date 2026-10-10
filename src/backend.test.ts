// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { seedDatabase } from "./seed";
import { loadCloud, saveCloud } from "./cloud";
import { detectConflicts } from "./engine";
const adapter = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ requireClient: () => ({ rpc: adapter.rpc }) }));
const admin = "00000000-0000-4000-8000-000000000001",
  citizen = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003",
  officer = "00000000-0000-4000-8000-000000000004";
let db: PGlite;
const project = seedDatabase().projects[0];
async function actor(id: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function commit(operations: unknown[]) {
  return db.query("select public.civic_commit($1::jsonb)", [
    JSON.stringify(operations),
  ]);
}
async function record(table: string, id: string) {
  return (
    await db.query<{ data: unknown }>(
      `select data from public.${table} where id=$1`,
      [id],
    )
  ).rows[0]?.data;
}
const report = {
  id: "REP-PRIVATE",
  category: "Pothole",
  description: "A pothole requires repair near the crossing.",
  location: "Avinashi Road",
  projectId: project.id,
  status: "Submitted",
  createdAt: "2000-01-01",
  updates: [],
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100001_authenticated_workspace.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100002_relational_catalog.sql",
      "utf8",
    ),
  );
  for (const road of seedDatabase().roads)
    await db.query("insert into public.road_segments values($1,$2,$3,$4,$5)", [
      road.id,
      road.name,
      road.verified,
      true,
      JSON.stringify(road.coordinates),
    ]);
  adapter.rpc.mockImplementation(
    async (name: string, args?: { operations: unknown[] }) => {
      try {
        if (name === "civic_snapshot")
          return {
            data: (
              await db.query<{ value: unknown }>(
                "select public.civic_snapshot() as value",
              )
            ).rows[0].value,
            error: null,
          };
        if (name === "civic_commit") {
          await commit(args!.operations);
          return { data: null, error: null };
        }
        throw new Error("Unknown RPC");
      } catch (e) {
        return {
          data: null,
          error: { message: e instanceof Error ? e.message : "Database error" },
        };
      }
    },
  );
  await db.query(
    "insert into auth.users values($1,$2,$3),($4,$5,$6),($7,$8,$9),($10,$11,$12)",
    [
      admin,
      "admin@example.test",
      "{}",
      citizen,
      "citizen@example.test",
      '{"role":"City Administrator"}',
      other,
      "other@example.test",
      "{}",
      officer,
      "officer@example.test",
      "{}",
    ],
  );
  await db.exec(
    `update public.profiles set role='City Administrator' where id='${admin}';update public.profiles set role='Department Officer',department='Water Department' where id='${officer}';`,
  );
  await db.exec(
    "alter table auth.users add column email_confirmed_at timestamptz default now()",
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    "reset role;delete from public.complaints;delete from public.coordination;delete from public.projects;",
  );
  await db.query("insert into public.projects(id,data) values($1,$2)", [
    project.id,
    JSON.stringify(project),
  ]);
  await actor(admin);
});
afterAll(async () => {
  await db?.close();
});
describe("actual PostgreSQL account permissions and transactional validation", () => {
  it("ignores administrator claims in signup metadata", async () => {
    await actor(citizen);
    expect(
      (await db.query<{ role: string }>("select role from public.profiles"))
        .rows,
    ).toEqual([{ role: "Citizen" }]);
  });
  it("rejects anonymous data access and RPC writes", async () => {
    await actor("", "anon");
    await expect(db.query("select * from public.projects")).rejects.toThrow();
    await expect(commit([])).rejects.toThrow();
  });
  it("prevents citizens from changing roles or projects directly or through RPC", async () => {
    await actor(citizen);
    await expect(
      db.query("update public.profiles set role='City Administrator'"),
    ).rejects.toThrow();
    await expect(
      db.query("update public.projects set data='{}'"),
    ).rejects.toThrow();
    await expect(
      commit([
        {
          kind: "projects",
          id: project.id,
          before: project,
          after: { ...project, name: "hacked" },
        },
      ]),
    ).rejects.toThrow("forbidden");
    await expect(
      db.query("select public.assign_civic_role($1,$2,$3)", [
        "other@example.test",
        "City Administrator",
        null,
      ]),
    ).rejects.toThrow("Administrator");
  });
  it("allows own reports but hides them from unrelated citizens and anonymous users", async () => {
    await actor(citizen);
    await commit([
      { kind: "complaints", id: report.id, before: null, after: report },
    ]);
    const saved = await record("complaints", report.id);
    expect(saved).toMatchObject({ status: "Submitted" });
    expect(saved).not.toMatchObject({ createdAt: "2000-01-01" });
    await actor(other);
    expect(await record("complaints", report.id)).toBeUndefined();
    await expect(
      commit([
        {
          kind: "complaints",
          id: report.id,
          before: saved,
          after: { ...(saved as object), status: "Under Review" },
        },
      ]),
    ).rejects.toThrow("forbidden");
  });
  it("limits officers to their department, including report access", async () => {
    await actor(officer);
    await commit([
      {
        kind: "projects",
        id: project.id,
        before: project,
        after: { ...project, name: "Authorized water works" },
      },
    ]);
    await expect(
      commit([
        {
          kind: "projects",
          id: "EL-1",
          before: null,
          after: {
            ...project,
            id: "EL-1",
            department: "Electricity Department",
          },
        },
      ]),
    ).rejects.toThrow("department");
    const existing = await record("projects", project.id);
    await expect(
      commit([
        { kind: "projects", id: project.id, before: existing, after: null },
      ]),
    ).rejects.toThrow("department");
    await actor(citizen);
    await commit([
      {
        kind: "complaints",
        id: report.id,
        before: null,
        after: { ...report, projectId: "" },
      },
    ]);
    await actor(officer);
    expect(await record("complaints", report.id)).toBeUndefined();
  });
  it("enforces sequential status updates and immutable complaint content", async () => {
    await actor(citizen);
    await commit([
      { kind: "complaints", id: report.id, before: null, after: report },
    ]);
    await actor(officer);
    const saved = (await record("complaints", report.id)) as typeof report;
    await expect(
      commit([
        {
          kind: "complaints",
          id: report.id,
          before: saved,
          after: { ...saved, status: "Resolved" },
        },
      ]),
    ).rejects.toThrow("one status");
    await expect(
      commit([
        {
          kind: "complaints",
          id: report.id,
          before: saved,
          after: { ...saved, status: "Under Review", description: "altered" },
        },
      ]),
    ).rejects.toThrow("immutable");
    await commit([
      {
        kind: "complaints",
        id: report.id,
        before: saved,
        after: { ...saved, status: "Under Review" },
      },
    ]);
    expect(await record("complaints", report.id)).toMatchObject({
      status: "Under Review",
    });
  });
  it("rejects stale writes without overwriting another user’s changes", async () => {
    await commit([
      {
        kind: "projects",
        id: project.id,
        before: project,
        after: { ...project, name: "First change" },
      },
    ]);
    await expect(
      commit([
        {
          kind: "projects",
          id: project.id,
          before: project,
          after: { ...project, name: "Stale change" },
        },
      ]),
    ).rejects.toThrow("changed");
    expect(await record("projects", project.id)).toMatchObject({
      name: "First change",
    });
  });
  it("rolls back the entire batch when one operation fails", async () => {
    await expect(
      commit([
        {
          kind: "projects",
          id: project.id,
          before: project,
          after: { ...project, name: "Should roll back" },
        },
        {
          kind: "projects",
          id: "BAD",
          before: null,
          after: { ...project, id: "BAD", end: "2026-01-01" },
        },
      ]),
    ).rejects.toThrow();
    expect(await record("projects", project.id)).toMatchObject({
      name: project.name,
    });
  });
  it("preserves project history and stamps updates on the server", async () => {
    await commit([
      {
        kind: "projects",
        id: project.id,
        before: project,
        after: { ...project, updates: [] },
      },
    ]);
    const saved = (await record("projects", project.id)) as typeof project;
    expect(saved.updates.slice(0, project.updates.length)).toEqual(
      project.updates,
    );
    expect(saved.updates).toHaveLength(project.updates.length + 1);
  });
  it("rejects invalid project coordinates and invalid photos", async () => {
    await expect(
      commit([
        {
          kind: "projects",
          id: project.id,
          before: project,
          after: { ...project, lat: 500 },
        },
      ]),
    ).rejects.toThrow("coordinates");
    await actor(citizen);
    await expect(
      commit([
        {
          kind: "complaints",
          id: report.id,
          before: null,
          after: { ...report, photo: "https://untrusted.example/image" },
        },
      ]),
    ).rejects.toThrow("photograph");
  });
  it("allows administrators to assign access but not modify their own role", async () => {
    await db.query("select public.assign_civic_role($1,$2,$3)", [
      "other@example.test",
      "Department Officer",
      "Electricity Department",
    ]);
    expect(
      (
        await db.query(
          "select role,department from public.profiles where id=$1",
          [other],
        )
      ).rows[0],
    ).toEqual({
      role: "Department Officer",
      department: "Electricity Department",
    });
    await db.query("select public.assign_civic_role($1,$2,$3)", [
      "other@example.test",
      "Citizen",
      null,
    ]);
    await expect(
      db.query("select public.assign_civic_role($1,$2,$3)", [
        "admin@example.test",
        "Citizen",
        null,
      ]),
    ).rejects.toThrow("own access");
  });
});

describe("relational catalog and real data adapter", () => {
  it("loads projects, road geometry, departments and relational history in one RLS snapshot", async () => {
    const data = await loadCloud();
    expect(data.departments).toHaveLength(4);
    expect(data.roads).toHaveLength(6);
    expect(data.projects[0].updates).toEqual(project.updates);
    expect(
      (
        await db.query(
          "select department_id,road_segment_id from public.projects",
        )
      ).rows[0],
    ).toEqual({ department_id: "water", road_segment_id: "av-01" });
  });
  it("runs conflict detection on saved data and recalculates after an adapter edit", async () => {
    const before = await loadCloud();
    const added = {
      ...project,
      id: "POWER-NEW",
      type: "Underground cable" as const,
      department: "Electricity Department",
      start: "2026-10-17",
      end: "2026-10-20",
    };
    await saveCloud(before, {
      ...before,
      projects: [...before.projects, added],
    });
    const stored = await loadCloud();
    expect(detectConflicts(stored.projects, stored.roads, 7)).toHaveLength(1);
    await saveCloud(stored, {
      ...stored,
      projects: stored.projects.map((p) =>
        p.id === added.id
          ? { ...p, start: "2026-11-15", end: "2026-11-19" }
          : p,
      ),
    });
    const revised = await loadCloud();
    expect(detectConflicts(revised.projects, revised.roads, 7)).toHaveLength(0);
    expect(
      revised.projects.find((p) => p.id === added.id)!.updates,
    ).toHaveLength(2);
  });
  it("keeps snapshot complaint tracking private and status updates visible to the owner", async () => {
    await actor(citizen);
    const before = await loadCloud();
    await saveCloud(before, {
      ...before,
      complaints: [
        { ...report, updates: [] } as (typeof before.complaints)[number],
      ],
    });
    await actor(other);
    expect((await loadCloud()).complaints).toHaveLength(0);
    await actor(officer);
    const staff = await loadCloud();
    await saveCloud(staff, {
      ...staff,
      complaints: staff.complaints.map((c) => ({
        ...c,
        status: "Under Review",
      })),
    });
    await actor(citizen);
    expect((await loadCloud()).complaints[0].status).toBe("Under Review");
  });
  it("rejects unknown road IDs and unauthorized catalog changes", async () => {
    await expect(
      commit([
        {
          kind: "projects",
          id: project.id,
          before: project,
          after: { ...project, roadId: "missing" },
        },
      ]),
    ).rejects.toThrow("Unknown road");
    await actor(citizen);
    await expect(
      db.query("select public.add_civic_catalog($1,$2)", [
        "department",
        JSON.stringify({ id: "parks", name: "Parks Department" }),
      ]),
    ).rejects.toThrow("Administrator");
    await expect(
      db.query(
        "insert into public.road_segments values('x','x',true,false,'[[1,2],[3,4]]')",
      ),
    ).rejects.toThrow();
  });
  it("allows a database-defined department and road without any built-in sample data", async () => {
    await db.query("select public.add_civic_catalog($1,$2)", [
      "department",
      JSON.stringify({ id: "parks", name: "Parks Department" }),
    ]);
    await db.query("select public.add_civic_catalog($1,$2)", [
      "road",
      JSON.stringify({
        id: "real-road",
        name: "Surveyed city road",
        verified: true,
        coordinates: [
          [11, 77],
          [11.01, 77.01],
        ],
      }),
    ]);
    await commit([
      {
        kind: "projects",
        id: "REAL",
        before: null,
        after: {
          ...project,
          id: "REAL",
          department: "Parks Department",
          roadId: "real-road",
          roadName: "Surveyed city road",
          isIllustrative: false,
        },
      },
    ]);
    const data = await loadCloud();
    expect(data.projects.find((p) => p.id === "REAL")?.isIllustrative).toBe(
      false,
    );
    expect(data.roads.find((r) => r.id === "real-road")?.isIllustrative).toBe(
      false,
    );
  });
  it("preserves report references when a linked project is deleted", async () => {
    await actor(citizen);
    await commit([
      { kind: "complaints", id: report.id, before: null, after: report },
    ]);
    await actor(admin);
    await commit([
      { kind: "projects", id: project.id, before: project, after: null },
    ]);
    expect(
      (await db.query("select project_id,data from public.complaints")).rows[0],
    ).toMatchObject({ project_id: null, data: { projectId: project.id } });
    expect(
      (
        await db.query(
          "select * from public.project_updates where project_id=$1",
          [project.id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("does not let anonymous callers obtain a workspace snapshot", async () => {
    await actor("", "anon");
    await expect(db.query("select public.civic_snapshot()")).rejects.toThrow();
  });
});

describe("stored public notes and optional sample import", () => {
  it("preserves the submitted timeline note with server-owned timestamp and relational history", async () => {
    const before = await loadCloud();
    await saveCloud(before, {
      ...before,
      projects: before.projects.map((p) => ({
        ...p,
        updates: [
          ...p.updates,
          {
            id: "client",
            at: "2000-01-01",
            department: p.department,
            description: "Traffic diversion approved for the north lane.",
          },
        ],
      })),
    });
    const saved = (await loadCloud()).projects[0].updates.at(-1)!;
    expect(saved.description).toContain(
      "Traffic diversion approved for the north lane.",
    );
    expect(saved.at).not.toBe("2000-01-01");
    expect(saved.id).not.toBe("client");
  });
  it("imports samples atomically, labels them, and cannot overwrite an occupied register", async () => {
    await db.exec(
      "reset role;delete from public.projects;delete from public.road_segments;",
    );
    await actor(admin);
    const seed = seedDatabase();
    const args = [JSON.stringify(seed.projects), JSON.stringify(seed.roads)];
    await db.query("select public.import_civic_demo($1,$2)", args);
    const data = await loadCloud();
    expect(data.projects).toHaveLength(10);
    expect(data.roads).toHaveLength(6);
    expect(data.projects.every((p) => p.isIllustrative)).toBe(true);
    expect(data.roads.every((r) => r.isIllustrative)).toBe(true);
    expect(data.complaints).toHaveLength(0);
    await expect(
      db.query("select public.import_civic_demo($1,$2)", args),
    ).rejects.toThrow("empty");
    await actor(citizen);
    await expect(
      db.query("select public.import_civic_demo($1,$2)", args),
    ).rejects.toThrow("Administrator");
  });
});

describe("three real-account role boundaries", () => {
  it("denies officer role assignment and direct profile writes", async () => {
    await actor(officer);
    await expect(
      db.query("select public.assign_civic_role($1,$2,$3)", [
        "citizen@example.test",
        "City Administrator",
        null,
      ]),
    ).rejects.toThrow("Administrator");
    await expect(
      db.query(
        "update public.profiles set role='City Administrator' where id=$1",
        [officer],
      ),
    ).rejects.toThrow();
  });
  it("rejects missing or nonexistent officer departments without changing the account", async () => {
    for (const department of [null, "Nonexistent Department"]) {
      await expect(
        db.query("select public.assign_civic_role($1,$2,$3)", [
          "citizen@example.test",
          "Department Officer",
          department,
        ]),
      ).rejects.toThrow();
    }
    expect(
      (
        await db.query(
          "select role,department from public.profiles where id=$1",
          [citizen],
        )
      ).rows[0],
    ).toEqual({ role: "Citizen", department: null });
  });
  it("restricts city settings to administrators even through direct RPC calls", async () => {
    const operation = {
      kind: "settings",
      id: "city",
      before: { windowDays: 7 },
      after: { windowDays: 14 },
    };
    for (const id of [citizen, officer]) {
      await actor(id);
      await expect(commit([operation])).rejects.toThrow(
        "Settings write forbidden",
      );
    }
    await actor(admin);
    await commit([operation]);
    expect((await loadCloud()).windowDays).toBe(14);
    await commit([
      { ...operation, before: operation.after, after: operation.before },
    ]);
  });
  it("blocks citizen coordination writes and scopes officer writes to involved projects", async () => {
    const value = {
      id: "CF:test",
      status: "Under review",
      notes: [],
      conflict: { projectIds: [project.id] },
    };
    const operation = {
      kind: "coordination",
      id: value.id,
      before: null,
      after: value,
    };
    await actor(citizen);
    await expect(commit([operation])).rejects.toThrow("forbidden");
    await actor(officer);
    await expect(
      commit([
        {
          ...operation,
          after: { ...value, conflict: { projectIds: ["outside-department"] } },
        },
      ]),
    ).rejects.toThrow("outside assigned department");
    await commit([operation]);
    expect(Object.keys((await loadCloud()).coordination)).toEqual([value.id]);
    await actor(citizen);
    expect((await loadCloud()).coordination).toEqual({});
  });
  it("denies self-promotion through the role RPC for both unprivileged roles", async () => {
    for (const [id, email] of [
      [citizen, "citizen@example.test"],
      [officer, "officer@example.test"],
    ]) {
      await actor(id);
      await expect(
        db.query("select public.assign_civic_role($1,$2,$3)", [
          email,
          "City Administrator",
          null,
        ]),
      ).rejects.toThrow("Administrator");
    }
  });
});
const roleSetup = readFileSync("supabase/setup/test_account_roles.sql", "utf8")
  .replace("YOUR-ADMIN-EMAIL", "admin@example.test")
  .replace("YOUR-OFFICER-EMAIL", "officer@example.test")
  .replace("YOUR-CITIZEN-EMAIL", "citizen@example.test");
describe("exact trusted test-account setup SQL", () => {
  it("configures existing confirmed accounts and leaves project records intact", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.profiles set role='Citizen',department=null where id in ($1,$2)",
      [admin, officer],
    );
    await db.exec(roleSetup);
    expect(
      (
        await db.query(
          "select role,department from public.profiles where id=$1",
          [admin],
        )
      ).rows[0],
    ).toEqual({ role: "City Administrator", department: null });
    expect(
      (
        await db.query(
          "select role,department from public.profiles where id=$1",
          [officer],
        )
      ).rows[0],
    ).toEqual({ role: "Department Officer", department: "Water Department" });
    expect(
      (
        await db.query("select role from public.profiles where id=$1", [
          citizen,
        ])
      ).rows[0],
    ).toEqual({ role: "Citizen" });
    expect(await record("projects", project.id)).toMatchObject({
      name: project.name,
    });
  });
  it("rejects an invalid department and rolls back all assignments", async () => {
    await db.exec("reset role");
    try {
      await expect(
        db.exec(
          roleSetup.replace("'Water Department'", "'Missing Department'"),
        ),
      ).rejects.toThrow("existing department");
    } finally {
      await db.exec("rollback");
    }
  });
  it("requires a confirmed account before making any assignment", async () => {
    await db.exec("reset role");
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [officer],
    );
    try {
      await expect(db.exec(roleSetup)).rejects.toThrow("no rows");
    } finally {
      await db.exec("rollback");
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [officer],
      );
    }
  });
});
