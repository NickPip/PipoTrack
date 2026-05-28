// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserModal, { type UserRow } from "./UserModal";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

function fillRequired(inputs: {
  name?: string; surname?: string; email?: string; password?: string; id?: string; phone?: string;
}) {
  return (async () => {
    const user = userEvent.setup();
    if (inputs.name !== undefined) await user.type(screen.getByPlaceholderText("John"), inputs.name);
    if (inputs.surname !== undefined) await user.type(screen.getByPlaceholderText("Doe"), inputs.surname);
    if (inputs.email !== undefined) await user.type(screen.getByPlaceholderText("john@company.com"), inputs.email);
    if (inputs.password !== undefined) {
      const pw = document.querySelector('input[type="password"]') as HTMLInputElement;
      await user.type(pw, inputs.password);
    }
    if (inputs.id !== undefined) await user.type(screen.getByPlaceholderText("ID001"), inputs.id);
    if (inputs.phone !== undefined) await user.type(screen.getByPlaceholderText("+1 555 0000"), inputs.phone);
  })();
}

const EXISTING: UserRow = {
  id: "user-1",
  name: "Jane",
  surname: "Doe",
  email: "jane@co.com",
  idNumber: "ID007",
  role: "OPERATIONS",
  phoneNumber: "+1 555 1234",
};

describe("UserModal", () => {
  it("renders the create title and Add User button when no user is given", () => {
    render(<UserModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add user/i })).toBeInTheDocument();
    expect(screen.getByText("Fields marked with * are required.")).toBeInTheDocument();
  });

  it("blocks submit and shows validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<UserModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add user/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not submit when the email is invalid", async () => {
    // The email input is type="email", so the browser's native constraint
    // validation blocks submission before it reaches the network — assert the
    // user-facing guarantee (no save fires) rather than a specific message.
    const user = userEvent.setup();
    render(<UserModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await fillRequired({
      name: "John", surname: "Smith", email: "not-an-email",
      password: "secret1", id: "ID1", phone: "+1 555 0000",
    });
    await user.click(screen.getByRole("button", { name: /add user/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    const emailInput = screen.getByPlaceholderText("john@company.com") as HTMLInputElement;
    expect(emailInput.validity.valid).toBe(false);
  });

  it("creates a user: POSTs to /api/users then calls onSaved + onClose", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<UserModal open onClose={onClose} onSaved={onSaved} />);

    await fillRequired({
      name: "John", surname: "Smith", email: "john@co.com",
      password: "secret1", id: "ID1", phone: "+1 555 0000",
    });
    await user.click(screen.getByRole("button", { name: /add user/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ name: "John", email: "john@co.com", password: "secret1" });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("edits a user: PUTs to /api/users/{id} and omits a blank password", async () => {
    const user = userEvent.setup();
    render(<UserModal open onClose={vi.fn()} onSaved={vi.fn()} user={EXISTING} />);

    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users/user-1");
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body);
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ email: "jane@co.com", role: "OPERATIONS" });
  });

  it("surfaces an API error message on a failed save", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Email already in use" }) });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<UserModal open onClose={vi.fn()} onSaved={onSaved} />);

    await fillRequired({
      name: "John", surname: "Smith", email: "dupe@co.com",
      password: "secret1", id: "ID1", phone: "+1 555 0000",
    });
    await user.click(screen.getByRole("button", { name: /add user/i }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
