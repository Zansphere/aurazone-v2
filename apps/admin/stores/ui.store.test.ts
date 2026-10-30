import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui.store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ mobileSidebarOpen: false });
  });

  it("should have correct initial state", () => {
    const state = useUiStore.getState();
    expect(state.mobileSidebarOpen).toBe(false);
  });

  it("should set mobileSidebarOpen directly", () => {
    useUiStore.getState().setMobileSidebarOpen(true);
    expect(useUiStore.getState().mobileSidebarOpen).toBe(true);

    useUiStore.getState().setMobileSidebarOpen(false);
    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
  });

  it("should toggle mobileSidebarOpen", () => {
    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);

    useUiStore.getState().toggleMobileSidebar();
    expect(useUiStore.getState().mobileSidebarOpen).toBe(true);

    useUiStore.getState().toggleMobileSidebar();
    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
  });
});

