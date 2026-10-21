import PasswordCard from "@/app/(app)/settings/user/components/password-card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ listAccounts: vi.fn(), changePassword: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: auth }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ user: { id: "password-user" } }),
}));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PasswordCard />
    </QueryClientProvider>
  );
  return { ...view, client };
}

async function fill(confirmation = "new-password") {
  fireEvent.change(await screen.findByLabelText("current", { exact: false }), {
    target: { value: "old-password" },
  });
  fireEvent.change(screen.getByLabelText("new", { exact: false }), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("confirm", { exact: false }), {
    target: { value: confirmation },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "title" }));
}

describe("PasswordCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }], error: null });
    auth.changePassword.mockResolvedValue({ data: { user: { id: "password-user" } }, error: null });
  });
  afterEach(cleanup);

  it("changes the password through Better Auth and clears the fields", async () => {
    mount();
    await fill();
    expect(screen.getByLabelText("current", { exact: false })).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(screen.getByLabelText("new", { exact: false })).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("new", { exact: false })).toHaveAttribute("maxlength", "128");
    submit();
    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith({
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent("success");
    expect(screen.getByLabelText("current", { exact: false })).toHaveValue("");
    expect(screen.getByLabelText("new", { exact: false })).toHaveValue("");
    expect(screen.getByLabelText("confirm", { exact: false })).toHaveValue("");
  });

  it("does not submit mismatched passwords", async () => {
    mount();
    await fill("different-password");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("mismatch");
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it("allows other sessions to remain signed in", async () => {
    mount();
    await fill();
    fireEvent.click(screen.getByRole("switch"));
    submit();
    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith(
        expect.objectContaining({ revokeOtherSessions: false })
      )
    );
  });

  it("shows an incorrect-current-password error without displaying server text", async () => {
    auth.changePassword.mockResolvedValue({
      error: { code: "INVALID_PASSWORD", message: "private detail" },
    });
    mount();
    await fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrectPassword");
    expect(screen.queryByText("private detail")).not.toBeInTheDocument();
  });

  it("recovers from network errors", async () => {
    auth.changePassword.mockRejectedValue(new Error("private detail"));
    mount();
    await fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("error");
    expect(screen.getByRole("button", { name: "title" })).toBeEnabled();
  });

  it("does not offer password creation for SSO-only accounts", async () => {
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: "oidc" }], error: null });
    const view = mount();
    await waitFor(() =>
      expect(view.client.getQueryState(["auth", "accounts", "password-user"])?.status).toBe(
        "success"
      )
    );
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it("lets users retry loading account providers", async () => {
    auth.listAccounts.mockResolvedValueOnce({ error: { message: "unavailable" } });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("loadError");
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(await screen.findByLabelText("current", { exact: false })).toBeInTheDocument();
  });
});
