// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OwnerModal, { type OwnerRow } from "./OwnerModal";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

async function fillRequired(u: ReturnType<typeof userEvent.setup>, email = "owner@co.com") {
  await u.type(screen.getByPlaceholderText("Acme Logistics LLC"), "Acme LLC");
  await u.type(screen.getByPlaceholderText("John Smith"), "John Smith");
  await u.type(screen.getByPlaceholderText("+1 555 0000"), "+1 555 1234");
  await u.type(screen.getByPlaceholderText("owner@company.com"), email);
  await u.type(screen.getByPlaceholderText("123 Main St, City, State 00000"), "1 Road St");
  await u.type(screen.getByPlaceholderText("XX-XXXXXXX"), "12-3456789");
}

const EXISTING: OwnerRow = {
  id: "owner-1",
  name: "Acme LLC",
  ownerName: "Jane Owner",
  email: "jane@acme.com",
  phone: "+1 555 0000",
  address: "5 Old Rd",
  ssnFein: "98-7654321",
};

describe("OwnerModal", () => {
  it("renders the create title and Add Owner button", () => {
    render(<OwnerModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add owner/i })).toBeInTheDocument();
  });

  it("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    render(<OwnerModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add owner/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not submit when the email is invalid", async () => {
    const user = userEvent.setup();
    render(<OwnerModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await fillRequired(user, "not-an-email");
    await user.click(screen.getByRole("button", { name: /add owner/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    const email = screen.getByPlaceholderText("owner@company.com") as HTMLInputElement;
    expect(email.validity.valid).toBe(false);
  });

  it("creates an owner: POSTs to /api/owners then calls onSaved + onClose", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<OwnerModal open onClose={onClose} onSaved={onSaved} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /add owner/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/owners");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ name: "Acme LLC", email: "owner@co.com" });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("edits an owner: PUTs to /api/owners/{id}", async () => {
    const user = userEvent.setup();
    render(<OwnerModal open onClose={vi.fn()} onSaved={vi.fn()} owner={EXISTING} />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/owners/owner-1");
    expect(opts.method).toBe("PUT");
  });

  it("surfaces an API error on a failed save", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Email already in use" }) });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<OwnerModal open onClose={vi.fn()} onSaved={onSaved} />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /add owner/i }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
