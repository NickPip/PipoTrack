// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddLoadModal, { type LoadRow } from "./AddLoadModal";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // The modal loads users + units for its dropdowns; everything else is ok.
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u === "/api/users")
      return {
        ok: true,
        json: async () => [
          { id: "u-disp", name: "Dee", surname: "Spatcher", role: "DISPATCHER" },
          { id: "u-ops", name: "Ollie", surname: "Ops", role: "OPERATIONS" },
          { id: "u-rec", name: "Reese", surname: "Cruit", role: "RECRUITING" },
        ],
      };
    if (u === "/api/units") return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({}) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const loadCalls = () =>
  fetchMock.mock.calls.filter((c) => /\/api\/loads/.test(String(c[0])));

const EXISTING: LoadRow = {
  id: "load-9",
  loadNumber: 42,
  status: "PENDING",
  financialStatus: "UNPAID",
  broker: "XPO",
  pickupAddress: "1 A St",
  pickupDate: "11/03 18:30",
  deliveryAddress: "2 B St",
  deliveryDate: "11/04 08:30",
  createdAt: new Date().toISOString(),
};

describe("AddLoadModal", () => {
  it("renders the create title and Create load button", () => {
    renderWithClient(<AddLoadModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Add new load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create load/i })).toBeInTheDocument();
  });

  it("blocks the save request and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    renderWithClient(<AddLoadModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /create load/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(loadCalls()).toHaveLength(0);
  });

  it("offers only Operations/Admin as Tracking ID and Dispatcher/Admin as Dispatcher", async () => {
    renderWithClient(<AddLoadModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    // Wait for the users query to populate the dropdowns.
    await screen.findByRole("option", { name: "Dee Spatcher" });

    // Operations user is a Tracking option; Dispatcher is a Dispatcher option;
    // each appears exactly once (only in its eligible select).
    expect(screen.getAllByRole("option", { name: "Ollie Ops" })).toHaveLength(1);
    expect(screen.getAllByRole("option", { name: "Dee Spatcher" })).toHaveLength(1);

    // The Recruiting user is eligible for neither field.
    expect(screen.queryByRole("option", { name: "Reese Cruit" })).toBeNull();
  });

  it("renders edit mode with the load number and Save changes button", () => {
    renderWithClient(<AddLoadModal open onClose={vi.fn()} onSaved={vi.fn()} load={EXISTING} />);
    expect(screen.getByText("Edit load #42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});
