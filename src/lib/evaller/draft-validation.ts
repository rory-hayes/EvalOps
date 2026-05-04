export function normalizeQualityBarInput(input: string) {
  const trimmed = input.trim();
  const value = Number(trimmed);
  if (!trimmed || !Number.isInteger(value)) {
    return {
      value: null,
      issue: "Enter a whole number between 50 and 100.",
    };
  }

  if (value < 50 || value > 100) {
    return {
      value,
      issue: "Set the quality bar between 50 and 100.",
    };
  }

  return {
    value,
    issue: "",
  };
}

export function clampQualityBarInput(input: string) {
  const parsed = normalizeQualityBarInput(input);
  if (parsed.value === null) return 50;
  return Math.min(100, Math.max(50, parsed.value));
}
