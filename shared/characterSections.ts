export type SectionCharacter = {
  sectionsJson?: string | null;
  section?: string | null;
  createdAt?: string | Date | null;
};

export function sectionsOf(character: SectionCharacter): string[] {
  if (character.sectionsJson) {
    try {
      const value = JSON.parse(character.sectionsJson);
      if (Array.isArray(value) && value.length) return value.map(String);
    } catch {
      // Fall back to legacy single-section rows.
    }
  }
  return character.section ? [character.section] : ["new"];
}

export function isInSection(character: SectionCharacter, section: string, now = Date.now()): boolean {
  const sections = sectionsOf(character);
  if (sections.includes(section)) return true;
  const createdAt = character.createdAt ? new Date(character.createdAt).getTime() : NaN;
  return section === "featured" && sections.includes("new") && Number.isFinite(createdAt) && now - createdAt >= 7 * 24 * 60 * 60 * 1000;
}
