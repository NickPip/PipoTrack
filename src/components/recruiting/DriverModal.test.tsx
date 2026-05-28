// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DriverModal, { type DriverRow } from "./DriverModal";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

async function fillRequired(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByPlaceholderText("John Doe"), "Joe Trucker");
  await u.type(screen.getByPlaceholderText("+1 555 0000"), "+1 555 1111");
  await u.type(screen.getByPlaceholderText("123 Main St, City, State 00000"), "1 Road St");
  await u.type(screen.getByPlaceholderText("Jane Doe +1 555 9999"), "Jane +1 555 2222");
  await u.type(screen.getByPlaceholderText("DL-12345678"), "DL-99");
  await u.click(screen.getByRole("button", { name: "Citizen" }));
  await u.click(screen.getByRole("button", { name: "Yes" }));
}

const EXISTING: DriverRow = {
  id: "driver-1",
  name: "Existing Driver",
  phone: "+1 555 0000",
  address: "5 Old Rd",
  dlNumber: "DL-1",
  citizenshipType: "Resident",
  cleanBackground: false,
  emergencyContact: "Kin +1 555 3333",
};

describe("DriverModal", () => {
  it("renders the create title and Add Driver button", () => {
    render(<DriverModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add driver/i })).toBeInTheDocument();
  });

  it("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    render(<DriverModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add driver/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a driver: POSTs to /api/drivers with the chosen pills", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<DriverModal open onClose={onClose} onSaved={onSaved} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /add driver/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/drivers");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      name: "Joe Trucker",
      citizenshipType: "Citizen",
      cleanBackground: true,
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("edits a driver: PUTs to /api/drivers/{id}", async () => {
    const user = userEvent.setup();
    render(<DriverModal open onClose={vi.fn()} onSaved={vi.fn()} driver={EXISTING} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/drivers/driver-1");
    expect(opts.method).toBe("PUT");
  });

  it("surfaces an API error on a failed save", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "DL number already in use" }) });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DriverModal open onClose={vi.fn()} onSaved={onSaved} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /add driver/i }));

    expect(await screen.findByText("DL number already in use")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
