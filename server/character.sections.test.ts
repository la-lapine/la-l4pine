import { describe, expect, it } from "vitest";
import { isInSection, sectionsOf } from "../shared/characterSections";

describe("character section visibility", () => {
  const now = Date.parse("2026-09-14T00:00:00Z");

  it("supports multiple explicitly selected sections", () => {
    const character = { sectionsJson: JSON.stringify(["new", "coming"]), section: "new" };
    expect(sectionsOf(character)).toEqual(["new", "coming"]);
    expect(isInSection(character, "coming", now)).toBe(true);
    expect(isInSection(character, "featured", now)).toBe(false);
  });

  it("promotes a new character to featured after seven days", () => {
    const character = { sectionsJson: JSON.stringify(["new"]), createdAt: "2026-09-06T00:00:00Z" };
    expect(isInSection(character, "featured", now)).toBe(true);
  });

  it("keeps a recent new character out of featured", () => {
    const character = { sectionsJson: JSON.stringify(["new"]), createdAt: "2026-09-10T00:00:00Z" };
    expect(isInSection(character, "featured", now)).toBe(false);
  });
});
