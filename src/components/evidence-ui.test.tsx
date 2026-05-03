import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CalibrationSummaryPanel,
  ConfidenceBadge,
  EvidenceList,
} from "./evidence-ui";

describe("evidence UI components", () => {
  it("renders evidence references with labels, excerpts, and overflow count", () => {
    const html = renderToStaticMarkup(
      <EvidenceList
        title="Supporting evidence"
        items={[
          {
            id: "trace_01",
            type: "trace",
            label: "Refund escalation trace",
            excerpt: "Customer asked for an exception after policy cutoff.",
          },
          {
            id: "case_02",
            type: "eval_case",
            label: "Refund policy regression case",
          },
          {
            id: "policy_03",
            type: "report",
            label: "May audit finding",
          },
        ]}
        maxItems={2}
      />,
    );

    expect(html).toContain("Supporting evidence");
    expect(html).toContain("Refund escalation trace");
    expect(html).toContain("Customer asked for an exception after policy cutoff.");
    expect(html).toContain("Eval case");
    expect(html).toContain("+1 more evidence ref");
  });

  it("formats confidence values as calm status badges", () => {
    expect(renderToStaticMarkup(<ConfidenceBadge confidence={0.91} />)).toContain(
      "High confidence",
    );
    expect(renderToStaticMarkup(<ConfidenceBadge confidence={0.64} />)).toContain(
      "Medium confidence",
    );
    expect(renderToStaticMarkup(<ConfidenceBadge confidence={32} />)).toContain(
      "Low confidence",
    );
    expect(
      renderToStaticMarkup(<ConfidenceBadge confidence={undefined} label="Needs review" />),
    ).toContain("Needs review");
  });

  it("renders calibration summary metrics and disagreement rows", () => {
    const html = renderToStaticMarkup(
      <CalibrationSummaryPanel
        agreement={0.78}
        totalLabels={24}
        disagreementCount={3}
        status="review"
        lastCalibratedAt="2026-05-03T10:30:00.000Z"
        results={[
          {
            id: "cal_01",
            label: "Refund promise boundary",
            humanScore: 92,
            judgeScore: 74,
            scoreDelta: 18,
            severity: "medium",
            reviewStatus: "open",
          },
        ]}
      />,
    );

    expect(html).toContain("Judge calibration");
    expect(html).toContain("78%");
    expect(html).toContain("24");
    expect(html).toContain("3");
    expect(html).toContain("Refund promise boundary");
    expect(html).toContain("18 pt delta");
    expect(html).toContain("May 3, 2026");
  });
});
