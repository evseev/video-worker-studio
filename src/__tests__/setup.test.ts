import { describe, it, expect } from "vitest";

describe("Vitest setup", () => {
  it("runs tests successfully", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves @/ path alias", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    expect(createClient).toBeDefined();
  });
});
