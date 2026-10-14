/**
 * The root layout's error boundary renders its own document, without the
 * layout's locale or messages: it reads the catalogue in the browser's
 * language, and falls back to English.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import GlobalError from "@/app/global-error";

vi.mock("@/styles/globals.css", () => ({}));

function inBrowserLanguages(languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the global error page", () => {
  it("speaks the browser's language, by its region-less code too", async () => {
    inBrowserLanguages(["nl-NL", "en"]);
    render(<GlobalError error={new Error("boom")} retry={() => {}} />, {
      container: document.documentElement,
    });

    expect(await screen.findByText("Er ging iets mis.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Opnieuw proberen" })).toBeInTheDocument();
  });

  it("falls back to English for a language the catalogue does not hold", async () => {
    inBrowserLanguages(["sw-KE"]);
    render(<GlobalError error={new Error("boom")} retry={() => {}} />, {
      container: document.documentElement,
    });

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("tries again when asked", async () => {
    const retry = vi.fn();

    inBrowserLanguages(["en-GB"]);
    render(<GlobalError error={new Error("boom")} retry={retry} />, {
      container: document.documentElement,
    });
    (await screen.findByRole("button", { name: "Try again" })).click();

    expect(retry).toHaveBeenCalledOnce();
  });
});
