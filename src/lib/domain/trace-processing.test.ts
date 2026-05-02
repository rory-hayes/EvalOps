import { describe, expect, it } from "vitest";
import {
  buildCsvExport,
  buildEvalArtifacts,
  parseTraceFile,
  redactSensitiveText,
} from "./trace-processing";

describe("trace processing", () => {
  it("parses CSV prompt-output pairs into normalized traces", () => {
    const traces = parseTraceFile({
      fileName: "support.csv",
      contentType: "text/csv",
      text:
        "conversation_id,timestamp,user_input,assistant_output\n" +
        "c_1,2026-05-01T10:00:00.000Z,I was billed twice,Sorry - I can refund the duplicate charge",
    });

    expect(traces).toEqual([
      expect.objectContaining({
        externalId: "c_1",
        sourceType: "CSV",
        input: "I was billed twice",
        output: "Sorry - I can refund the duplicate charge",
        intent: "Billing",
        riskLevel: "medium",
      }),
    ]);
  });

  it("parses NDJSON rows and redacts likely sensitive values", () => {
    const traces = parseTraceFile({
      fileName: "events.ndjson",
      contentType: "application/x-ndjson",
      text: [
        JSON.stringify({
          id: "evt_1",
          prompt: "My email is jane@example.com and card 4242 4242 4242 4242",
          response: "I cannot take full card numbers here.",
        }),
      ].join("\n"),
    });

    expect(traces[0].redactedInput).toContain("[email]");
    expect(traces[0].redactedInput).toContain("[card]");
    expect(traces[0].redactionHits).toEqual(["email", "card"]);
  });

  it("creates deterministic eval cases, issues, and report metrics from persisted traces", () => {
    const artifacts = buildEvalArtifacts({
      projectId: "proj_1",
      traces: [
        {
          externalId: "t_1",
          sourceType: "TXT",
          input: "I asked three times and this is still not fixed",
          output: "Try restarting the app.",
          redactedInput: "I asked three times and this is still not fixed",
          redactedOutput: "Try restarting the app.",
          redactionHits: [],
          intent: "Escalation",
          riskLevel: "high",
          occurredAt: "2026-05-01T10:00:00.000Z",
          metadata: {},
        },
      ],
    });

    expect(artifacts.evalCases).toHaveLength(1);
    expect(artifacts.evalCases[0]).toMatchObject({
      intent: "Escalation",
      set: "regression",
      risk: "high",
      status: "failed",
    });
    expect(artifacts.issues).toEqual([
      expect.objectContaining({
        severity: "high",
        status: "open",
        title: expect.stringContaining("Escalation"),
      }),
    ]);
    expect(artifacts.report.summary).toContain("1 trace");
  });

  it("builds CSV exports from real eval cases and issues", () => {
    const csv = buildCsvExport({
      evalCases: [
        {
          id: "case_1",
          name: "Escalation request",
          set: "regression",
          intent: "Escalation",
          source: "production",
          risk: "high",
          grader: "Deterministic rubric",
          lastResult: 40,
          status: "failed",
          userInput: "This is still not fixed",
          expectedBehavior: "Escalate to a human",
          acceptanceCriteria: ["Acknowledges frustration", "Creates handoff"],
        },
      ],
      issues: [
        {
          id: "issue_1",
          evalCaseId: "case_1",
          title: "Missing human handoff",
          severity: "high",
          status: "open",
          description: "Expected escalation.",
        },
      ],
    });

    expect(csv).toContain("case_id,name,set,intent,risk,status,last_result,open_issues");
    expect(csv).toContain("case_1,Escalation request,regression,Escalation,high,failed,40,1");
  });

  it("redacts secrets without changing safe text", () => {
    expect(redactSensitiveText("Contact rory@example.com with token sk-test-1234567890").text).toBe(
      "Contact [email] with token [secret]",
    );
    expect(redactSensitiveText("No sensitive values here").text).toBe(
      "No sensitive values here",
    );
  });
});
