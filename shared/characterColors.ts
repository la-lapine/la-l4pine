export type CardColorInput = {
  titleColor?: string | null;
  bodyColor?: string | null;
  colorSync?: number | null;
};

const FALLBACK_TITLE = "#eff8ff";
const FALLBACK_BODY = "#9db8d4";

export function resolveCharacterColors(input: CardColorInput) {
  const titleColor = input.titleColor || FALLBACK_TITLE;
  const requestedBody = input.bodyColor || FALLBACK_BODY;
  return { titleColor, bodyColor: input.colorSync ? titleColor : requestedBody };
}
