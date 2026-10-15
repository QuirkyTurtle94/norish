"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseUnsavedNavigationGuardOptions {
  hasUnsavedChanges: boolean;
  confirmationMessage: string;
  onConfirmLeave: () => void;
}

function isEditableBackspaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target.closest(
      '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
    )
  ) {
    return true;
  }

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function useUnsavedNavigationGuard({
  hasUnsavedChanges,
  confirmationMessage,
  onConfirmLeave,
}: UseUnsavedNavigationGuardOptions) {
  const allowNavigationRef = useRef(false);

  const allowNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);

  const disallowNavigation = useCallback(() => {
    allowNavigationRef.current = false;
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!hasUnsavedChanges || allowNavigationRef.current) return true;

    return window.confirm(confirmationMessage);
  }, [confirmationMessage, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;

      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBackspaceNavigation = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" || isEditableBackspaceTarget(event.target)) return;

      event.preventDefault();

      if (!confirmNavigation()) return;

      allowNavigation();
      onConfirmLeave();
    };

    window.addEventListener("keydown", handleBackspaceNavigation, { capture: true });

    return () =>
      window.removeEventListener("keydown", handleBackspaceNavigation, { capture: true });
  }, [allowNavigation, confirmNavigation, hasUnsavedChanges, onConfirmLeave]);

  // A link in the app navigates without unloading the page, so beforeunload
  // never asks: the click is held in the capture phase, before the router's
  // own handler sees it. A link that opens elsewhere leaves this page as it is.
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleLinkClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;

      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;

      if (confirmNavigation()) {
        allowNavigation();

        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", handleLinkClick, { capture: true });

    return () => document.removeEventListener("click", handleLinkClick, { capture: true });
  }, [allowNavigation, confirmNavigation, hasUnsavedChanges]);

  // The browser's back and forward buttons move through the app's own history
  // without unloading either. Where the browser has the Navigation API, that
  // move can be cancelled before it happens; the browser decides whether it
  // may be (it asks for a recent interaction with the page).
  useEffect(() => {
    const browserNavigation = typeof navigation === "undefined" ? undefined : navigation;

    if (!hasUnsavedChanges || !browserNavigation) return;

    const handleNavigate = (event: NavigateEvent) => {
      if (event.navigationType !== "traverse" || !event.cancelable) return;

      if (confirmNavigation()) {
        allowNavigation();

        return;
      }
      event.preventDefault();
    };

    browserNavigation.addEventListener("navigate", handleNavigate);

    return () => browserNavigation.removeEventListener("navigate", handleNavigate);
  }, [allowNavigation, confirmNavigation, hasUnsavedChanges]);

  return { allowNavigation, confirmNavigation, disallowNavigation };
}
