import { describe, expect, it } from "vitest";
import { resolveCharacterColors } from "../shared/characterColors";

describe("character card colors", () => {
  it("keeps title and body colors independent when sync is off", () => {
    expect(resolveCharacterColors({ titleColor: "#112233", bodyColor: "#aabbcc", colorSync: 0 })).toEqual({ titleColor: "#112233", bodyColor: "#aabbcc" });
  });

  it("uses the title color for both surfaces when sync is on", () => {
    expect(resolveCharacterColors({ titleColor: "#112233", bodyColor: "#aabbcc", colorSync: 1 })).toEqual({ titleColor: "#112233", bodyColor: "#112233" });
  });
});
