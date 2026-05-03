import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type React from "react";
import type { WorkspaceState } from "./types";

export async function buildAuditReportPdf(state: WorkspaceState) {
  const buffer = await renderToBuffer(<AuditReportDocument state={state} />);
  return new Uint8Array(buffer);
}

function AuditReportDocument({ state }: { state: WorkspaceState }) {
  const project = state.activeProject;
  const report = state.reports[0];
  const latestRun = state.evalRuns[0];
  const openIssues = state.issues.filter((issue) => issue.status === "open");
  const passRate = latestRun?.passRate ?? 0;

  return (
    <Document
      title={`${project?.name || "EvalOps"} Audit Report`}
      author="EvalOps Copilot"
      subject="Eval Debt Audit"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>EvalOps Copilot</Text>
            <Text style={styles.title}>{project?.name || "Eval Debt Audit"}</Text>
            <Text style={styles.subtitle}>{project?.objective || "Private MVP audit report"}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Health</Text>
            <Text style={styles.score}>{Math.round(report?.readinessScore ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="Eval cases" value={String(state.evalCases.length)} />
          <Metric label="Open issues" value={String(openIssues.length)} />
          <Metric label="Pass rate" value={`${passRate}%`} />
          <Metric label="Reports" value={String(state.reports.length)} />
        </View>

        <Section title="Executive Summary">
          <Text style={styles.body}>
            {report?.summary || "No generated report is available yet."}
          </Text>
        </Section>

        <Section title="Top Risks">
          {(state.failureClusters.length ? state.failureClusters : []).slice(0, 5).map((cluster) => (
            <Row
              key={cluster.id}
              label={cluster.label}
              value={`${cluster.issueCount} issue${cluster.issueCount === 1 ? "" : "s"} - ${cluster.severity}`}
            />
          ))}
          {!state.failureClusters.length ? <Text style={styles.muted}>No failure clusters have been generated.</Text> : null}
        </Section>

        <Section title="Prioritized Recommendations">
          {(report?.recommendations || []).slice(0, 6).map((recommendation, index) => (
            <Text key={`${recommendation}-${index}`} style={styles.bullet}>
              {index + 1}. {recommendation}
            </Text>
          ))}
        </Section>

        <Section title="Routing And Caching">
          {state.routingRules.slice(0, 5).map((rule) => (
            <Row
              key={rule.id}
              label={`${rule.intent}: ${rule.model}`}
              value={`${rule.qualityScore}% quality, ${rule.estimatedLatencyMs}ms`}
            />
          ))}
          {state.cacheRecommendations.slice(0, 3).map((item) => (
            <Row
              key={item.id}
              label={item.title}
              value={`$${item.estimatedMonthlySavings}/mo`}
            />
          ))}
        </Section>

        <Text style={styles.footer}>Customer data remains customer-owned. This report is generated from derived audit artifacts.</Text>
      </Page>
    </Document>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 42,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#2563eb",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    maxWidth: 360,
    fontSize: 28,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 380,
    fontSize: 10,
    lineHeight: 1.5,
    color: "#475569",
  },
  scoreBox: {
    width: 92,
    height: 92,
    borderRadius: 6,
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreLabel: {
    fontSize: 9,
    textTransform: "uppercase",
  },
  score: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: 700,
  },
  metrics: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  metricLabel: {
    marginTop: 5,
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
  },
  section: {
    marginTop: 18,
    padding: 16,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: 700,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#334155",
  },
  bullet: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 1.45,
    color: "#334155",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLabel: {
    flexGrow: 1,
    maxWidth: 330,
    fontSize: 9.5,
    color: "#1e293b",
  },
  rowValue: {
    width: 130,
    textAlign: "right",
    fontSize: 9.5,
    color: "#475569",
  },
  muted: {
    fontSize: 10,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 26,
    fontSize: 8,
    color: "#64748b",
  },
});
