import { useUnsavedNavigationGuard } from "@/hooks/use-unsaved-navigation-guard";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  const dispatchResult = window.dispatchEvent(event);

  return { event, dispatchResult };
}

function dispatchBackspace(target: Window | HTMLElement = window) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Backspace",
  });

  target.dispatchEvent(event);

  return event;
}

describe("useUnsavedNavigationGuard", () => {
  const confirmSpy = vi.spyOn(window, "confirm");

  beforeEach(() => {
    confirmSpy.mockReset();
    confirmSpy.mockReturnValue(true);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not block beforeunload when there are no unsaved changes", () => {
    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: false,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    const { event, dispatchResult } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
    expect(dispatchResult).toBe(true);
  });

  it("blocks beforeunload while there are unsaved changes", () => {
    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    const { event, dispatchResult } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
    expect(dispatchResult).toBe(false);
  });

  it("allows beforeunload after navigation has been explicitly allowed", () => {
    const { result } = renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    act(() => result.current.allowNavigation());

    const { event, dispatchResult } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
    expect(dispatchResult).toBe(true);
  });

  it("can re-enable blocking after navigation was allowed", () => {
    const { result } = renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    act(() => {
      result.current.allowNavigation();
      result.current.disallowNavigation();
    });

    const { event } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
  });

  it("asks for confirmation when confirmNavigation is called with unsaved changes", () => {
    confirmSpy.mockReturnValue(false);

    const { result } = renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    expect(result.current.confirmNavigation()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith("Discard changes?");
  });

  it("does not ask for confirmation when navigation has already been allowed", () => {
    const { result } = renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave: vi.fn(),
      })
    );

    act(() => result.current.allowNavigation());

    expect(result.current.confirmNavigation()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("confirms and leaves when Backspace is pressed outside an editable target", () => {
    const onConfirmLeave = vi.fn();

    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave,
      })
    );

    const event = dispatchBackspace();

    expect(event.defaultPrevented).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith("Discard changes?");
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
  });

  it("prevents Backspace navigation but stays put when confirmation is rejected", () => {
    const onConfirmLeave = vi.fn();

    confirmSpy.mockReturnValue(false);

    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave,
      })
    );

    const event = dispatchBackspace();

    expect(event.defaultPrevented).toBe(true);
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });

  it("ignores Backspace in text inputs", () => {
    const onConfirmLeave = vi.fn();
    const input = document.createElement("input");

    document.body.append(input);

    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave,
      })
    );

    const event = dispatchBackspace(input);

    expect(event.defaultPrevented).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });

  it("ignores Backspace in textareas and contenteditable elements", () => {
    const onConfirmLeave = vi.fn();
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");

    editable.setAttribute("contenteditable", "true");
    document.body.append(textarea, editable);

    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: true,
        confirmationMessage: "Discard changes?",
        onConfirmLeave,
      })
    );

    const textareaEvent = dispatchBackspace(textarea);
    const editableEvent = dispatchBackspace(editable);

    expect(textareaEvent.defaultPrevented).toBe(false);
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });

  it("does not intercept Backspace when there are no unsaved changes", () => {
    const onConfirmLeave = vi.fn();

    renderHook(() =>
      useUnsavedNavigationGuard({
        hasUnsavedChanges: false,
        confirmationMessage: "Discard changes?",
        onConfirmLeave,
      })
    );

    const event = dispatchBackspace();

    expect(event.defaultPrevented).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onConfirmLeave).not.toHaveBeenCalled();
  });

  describe("leaving through a link in the app", () => {
    function clickLink(attributes: Record<string, string> = {}, init: MouseEventInit = {}) {
      const link = document.createElement("a");

      link.href = "/groceries";
      for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
      link.append(document.createElement("span"));
      document.body.append(link);

      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });

      link.firstElementChild!.dispatchEvent(event);

      return event;
    }

    function guard(hasUnsavedChanges = true) {
      return renderHook(() =>
        useUnsavedNavigationGuard({
          hasUnsavedChanges,
          confirmationMessage: "Discard changes?",
          onConfirmLeave: vi.fn(),
        })
      );
    }

    it("asks, and stays when the answer is no", () => {
      confirmSpy.mockReturnValue(false);
      guard();

      expect(clickLink().defaultPrevented).toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith("Discard changes?");
    });

    it("lets the link through when the answer is yes, without asking again on unload", () => {
      guard();

      expect(clickLink().defaultPrevented).toBe(false);
      expect(dispatchBeforeUnload().event.defaultPrevented).toBe(false);
    });

    it("leaves a link that opens elsewhere alone", () => {
      guard();

      clickLink({ target: "_blank" });
      clickLink({ download: "" });
      clickLink({}, { metaKey: true });
      clickLink({}, { ctrlKey: true });

      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it("does not ask without unsaved changes", () => {
      guard(false);

      expect(clickLink().defaultPrevented).toBe(false);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe("going back or forward in the browser", () => {
    const navigation = new EventTarget();

    function traverse(navigationType = "traverse", cancelable = true) {
      const event = Object.assign(new Event("navigate", { cancelable }), { navigationType });

      navigation.dispatchEvent(event);

      return event;
    }

    beforeEach(() => {
      vi.stubGlobal("navigation", navigation);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("asks, and stays when the answer is no", () => {
      confirmSpy.mockReturnValue(false);
      renderHook(() =>
        useUnsavedNavigationGuard({
          hasUnsavedChanges: true,
          confirmationMessage: "Discard changes?",
          onConfirmLeave: vi.fn(),
        })
      );

      expect(traverse().defaultPrevented).toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith("Discard changes?");
    });

    it("goes when the answer is yes, and leaves other navigations alone", () => {
      renderHook(() =>
        useUnsavedNavigationGuard({
          hasUnsavedChanges: true,
          confirmationMessage: "Discard changes?",
          onConfirmLeave: vi.fn(),
        })
      );

      expect(traverse("push").defaultPrevented).toBe(false);
      expect(traverse("traverse", false).defaultPrevented).toBe(false);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(traverse().defaultPrevented).toBe(false);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
  });
});
