import { describe, expect, it } from "vitest";
import { isPlausibleServerActionId } from "./server-action";

describe("заголовок Server Action", () => {
  it("відхиляє випадкові короткі значення", () => {
    expect(isPlausibleServerActionId("x")).toBe(false);
  });

  it("пропускає ідентифікатор очікуваної форми", () => {
    expect(isPlausibleServerActionId("a".repeat(40))).toBe(true);
  });
});
