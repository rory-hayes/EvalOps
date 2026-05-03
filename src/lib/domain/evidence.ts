export type NormalizedEvidenceRef = {
  id?: string;
  type?: string;
  label: string;
};

export type EvidenceSummary = {
  count: number;
  labels: string[];
  label: string;
  countLabel: string;
};

type EvidenceLike = {
  entityId?: unknown;
  entityType?: unknown;
  label?: unknown;
};

export function normalizeEvidenceRefs(
  refs: readonly unknown[] | null | undefined,
): NormalizedEvidenceRef[] {
  const normalized = (refs ?? [])
    .map(normalizeEvidenceRef)
    .filter((ref): ref is NormalizedEvidenceRef => Boolean(ref));
  const byKey = new Map<string, NormalizedEvidenceRef>();

  for (const ref of normalized) {
    const key =
      ref.id && ref.type ? `${ref.type}:${ref.id}` : ref.label.toLocaleLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, ref);
    }
  }

  return Array.from(byKey.values());
}

export function getEvidenceLabels(
  refs: readonly unknown[] | null | undefined,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  return normalizeEvidenceRefs(refs)
    .map((ref) => ref.label)
    .slice(0, Math.max(0, limit));
}

export function formatEvidenceCount(refs: readonly unknown[] | null | undefined): string {
  const count = normalizeEvidenceRefs(refs).length;
  if (count === 0) return "No evidence refs";
  if (count === 1) return "1 evidence ref";
  return `${count} evidence refs`;
}

export function summarizeEvidenceRefs(
  refs: readonly unknown[] | null | undefined,
  visibleLabels = 1,
): EvidenceSummary {
  const labels = getEvidenceLabels(refs);
  const visible = labels.slice(0, Math.max(0, visibleLabels));
  const remaining = labels.length - visible.length;

  return {
    count: labels.length,
    labels,
    label: [...visible, remaining > 0 ? `+${remaining} more` : ""]
      .filter(Boolean)
      .join(" ") || "No evidence",
    countLabel: formatEvidenceCount(refs),
  };
}

export function normalizeCalculationBasis(
  basis: unknown,
  fallback = "Basis not specified.",
): string {
  const text = Array.isArray(basis)
    ? basis.map(normalizeText).filter(Boolean).join("; ")
    : normalizeText(basis);

  return asSentence(text || fallback);
}

export function normalizeConfidenceText(confidence: unknown): string {
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    const normalized = confidence > 1 ? confidence / 100 : confidence;
    if (normalized >= 0.8) return "High confidence";
    if (normalized >= 0.6) return "Medium confidence";
    return "Low confidence";
  }

  const text = normalizeText(confidence);
  return text ? capitalize(text) : "Confidence not specified";
}

function normalizeEvidenceRef(ref: unknown): NormalizedEvidenceRef | null {
  if (typeof ref === "string" || typeof ref === "number") {
    const label = normalizeText(ref);
    return label ? { label } : null;
  }

  if (!isRecord(ref)) return null;

  const evidence = ref as EvidenceLike;
  const id = normalizeText(evidence.entityId);
  const type = normalizeText(evidence.entityType);
  const label =
    normalizeText(evidence.label) ||
    [humanizeEntityType(type), id].filter(Boolean).join(" ");

  if (!label) return null;

  return {
    ...(id ? { id } : {}),
    ...(type ? { type } : {}),
    label,
  };
}

function normalizeText(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function humanizeEntityType(type: string) {
  const label = type.replace(/[_-]+/g, " ").trim().toLocaleLowerCase();
  return label ? label.charAt(0).toLocaleUpperCase() + label.slice(1) : "";
}

function asSentence(text: string) {
  const sentence = capitalize(text);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function capitalize(text: string) {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
