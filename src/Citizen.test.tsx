import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "./store";
import { CitizenPortal, Reports } from "./Citizen";
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("submits a report, tracks it, and exposes the status to administrators", async () => {
  const view = render(
    <MemoryRouter>
      <Provider>
        <CitizenPortal />
      </Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
  fireEvent.change(screen.getByLabelText("Location"), {
    target: { value: "Avinashi Road" },
  });
  fireEvent.change(screen.getByLabelText("What is the issue?"), {
    target: { value: "An unsafe open trench needs temporary barriers." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit demo report" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Report saved");
  fireEvent.click(screen.getByRole("button", { name: "Track this report →" }));
  expect(
    screen.getByText("An unsafe open trench needs temporary barriers."),
  ).toBeInTheDocument();
  view.unmount();
  render(
    <MemoryRouter>
      <Provider>
        <Reports />
      </Provider>
    </MemoryRouter>,
  );
  const statuses = screen.getAllByRole("combobox");
  const last = statuses.at(-1)!;
  fireEvent.change(last, { target: { value: "Under Review" } });
  expect(last).toHaveValue("Under Review");
});
