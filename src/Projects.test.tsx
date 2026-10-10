import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, it, expect, vi } from "vitest";
import { seedDatabase } from "./seed";
const state = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("./store", () => ({ useStore: () => state.store }));
vi.mock("./CityMap", () => ({ CityMap: () => null }));
import { ProjectForm } from "./Projects";
afterEach(cleanup);
it("rejects a dirty editor after refreshed data changes the original record", () => {
  const data = seedDatabase(),
    p = data.projects[0],
    commit = vi.fn();
  state.store = {
    data,
    role: "City Administrator",
    isDemo: false,
    department: null,
    saving: false,
    commit,
  };
  const ui = () => (
    <MemoryRouter initialEntries={["/projects/" + p.id + "/edit"]}>
      <Routes>
        <Route path="/projects/:id/edit" element={<ProjectForm />} />
      </Routes>
    </MemoryRouter>
  );
  const view = render(ui());
  fireEvent.change(screen.getByLabelText("Project name", { exact: true }), {
    target: { value: "Stale local edit" },
  });
  state.store = {
    ...state.store,
    data: {
      ...data,
      projects: data.projects.map((x) =>
        x.id === p.id ? { ...x, name: "Another user saved this" } : x,
      ),
    },
  };
  view.rerender(ui());
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  expect(commit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "changed while you were editing",
  );
});
