import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, it, expect, vi } from "vitest";
import { seedDatabase } from "./seed";
const state = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("./store", () => ({ useStore: () => state.store }));
import { ReportCard } from "./Citizen";
afterEach(cleanup);
it("shows officer complaint controls only for linked projects in the assigned department", () => {
  const data = seedDatabase();
  const report = { ...data.complaints[0], projectId: data.projects[0].id };
  state.store = {
    data,
    role: "Department Officer",
    department: "Electricity Department",
    isDemo: false,
  };
  const ui = () => (
    <MemoryRouter>
      <ReportCard report={report} admin />
    </MemoryRouter>
  );
  const view = render(ui());
  expect(
    screen.queryByLabelText("Status for " + report.id),
  ).not.toBeInTheDocument();
  state.store = { ...state.store, department: data.projects[0].department };
  view.rerender(ui());
  expect(screen.getByLabelText("Status for " + report.id)).toBeInTheDocument();
});
