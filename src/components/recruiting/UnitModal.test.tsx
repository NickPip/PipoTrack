// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UnitModal, { type UnitRow } from "./UnitModal";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // Route by URL: owners/drivers feed the dependent dropdowns; everything else
  // (the unit create/update) gets a generic ok response.
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u === "/api/owners") return { ok: true, json: async () => [{ id: "owner-1", name: "Acme LLC" }] };
    if (u === "/api/drivers") return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({}) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// Calls to the unit create/update endpoint (excludes owners/drivers lookups).
const unitCalls = () =>
  fetchMock.mock.calls.filter((c) => /\/api\/units/.test(String(c[0])));

const EXISTING: UnitRow = {
  id: "unit-1",
  unitNumber: "U-100",
  type: "Cargo Van",
  make: "MB",
  model: "Sprinter",
  year: "2021",
  vin: "1ABC",
  plateNumber: "PLATE-1",
  ownerId: "owner-1",
  drivers: [],
  driverCount: 0,
};

describe("UnitModal", () => {
  it("renders the create title and Add Unit button", () => {
    renderWithClient(<UnitModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add unit/i })).toBeInTheDocument();
  });

  it("blocks the save request and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    renderWithClient(<UnitModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add unit/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(unitCalls()).toHaveLength(0);
  });

  it("creates a unit: POSTs to /api/units with the selected owner and type", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderWithClient(<UnitModal open onClose={onClose} onSaved={onSaved} />);

    // Wait for the owners query to populate the select.
    await screen.findByRole("option", { name: "Acme LLC" });

    await user.type(screen.getByPlaceholderText("U-001"), "U-200");
    await user.selectOptions(screen.getByRole("combobox"), "owner-1");
    await user.click(screen.getByRole("button", { name: "Cargo Van" }));
    await user.type(screen.getByPlaceholderText("Mercedes-Benz"), "MB");
    await user.type(screen.getByPlaceholderText("Sprinter 2500"), "Sprinter");
    await user.type(screen.getByPlaceholderText("2022"), "2023");
    await user.type(screen.getByPlaceholderText(/1FTFW1E5X/), "1XYZ");
    await user.type(screen.getByPlaceholderText("ABC-1234"), "PLATE-9");

    await user.click(screen.getByRole("button", { name: /add unit/i }));

    await waitFor(() => expect(unitCalls()).toHaveLength(1));
    const [url, opts] = unitCalls()[0];
    expect(url).toBe("/api/units");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({
      unitNumber: "U-200",
      ownerId: "owner-1",
      type: "Cargo Van",
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("edits a unit: PUTs to /api/units/{id}", async () => {
    const user = userEvent.setup();
    renderWithClient(<UnitModal open onClose={vi.fn()} onSaved={vi.fn()} unit={EXISTING} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(unitCalls()).toHaveLength(1));
    const [url, opts] = unitCalls()[0];
    expect(url).toBe("/api/units/unit-1");
    expect(opts.method).toBe("PUT");
  });
});
