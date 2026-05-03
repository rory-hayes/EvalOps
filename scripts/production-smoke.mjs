import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "EVALOPS_BASE_URL",
  "EVALOPS_SMOKE_TOKEN",
  "EVALOPS_SMOKE_EMAIL",
  "EVALOPS_SMOKE_PASSWORD",
  "EVALOPS_SMOKE_SECONDARY_EMAIL",
  "EVALOPS_SMOKE_SECONDARY_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const POLL_TIMEOUT_MS = Number(process.env.EVALOPS_SMOKE_TIMEOUT_MS || 180_000);
const POLL_INTERVAL_MS = Number(process.env.EVALOPS_SMOKE_POLL_INTERVAL_MS || 5_000);
const TRACE_FILE_TEXT = [
  "conversation_id,user_input,assistant_output",
  "smoke_1,I asked three times and this is still not fixed,Try restarting the app.",
].join("\n");

main().catch((error) => {
  console.error(`Production smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  assertRequiredEnv();
  const baseUrl = normalizeBaseUrl(process.env.EVALOPS_BASE_URL);
  const runId = `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  step(`Checking readiness at ${baseUrl}`);
  const readiness = await appFetch(baseUrl, "/api/readiness", {
    headers: {
      authorization: `Bearer ${process.env.EVALOPS_SMOKE_TOKEN}`,
    },
  });
  assert(readiness.response.ok, `Readiness failed with ${readiness.response.status}: ${JSON.stringify(readiness.body)}`);
  assert(readiness.body.ok === true, "Readiness payload did not report ok=true.");

  step("Signing in smoke users through Supabase Auth");
  const owner = await signIn(process.env.EVALOPS_SMOKE_EMAIL, process.env.EVALOPS_SMOKE_PASSWORD);
  const outsider = await signIn(
    process.env.EVALOPS_SMOKE_SECONDARY_EMAIL,
    process.env.EVALOPS_SMOKE_SECONDARY_PASSWORD,
  );
  const ownerCookie = sessionCookie(owner.session);

  step("Checking commercial billing readiness for smoke organization");
  const billingResponse = await appFetch(baseUrl, "/api/billing", {
    cookie: ownerCookie,
  });
  assert(billingResponse.response.ok, `Billing readiness failed: ${JSON.stringify(billingResponse.body)}`);
  assert(
    billingResponse.body.data?.canUseFeatures === true,
    "Smoke organization must have an active or trialing billing state before paid actions can run.",
  );

  step("Creating a smoke project through the deployed app API");
  const projectResponse = await appFetch(baseUrl, "/api/projects", {
    method: "POST",
    cookie: ownerCookie,
    json: {
      name: `Production Cutover ${runId}`,
      workflowType: "support_assistant",
      objective: "Verify the production Eval Debt Audit path with live vendors.",
      riskPreferences: ["Escalation", "Reliability", "Privacy"],
      privacyMode: "redact_pii",
    },
  });
  assert(projectResponse.response.ok, `Project creation failed: ${JSON.stringify(projectResponse.body)}`);
  const project = projectResponse.body.data;
  assert(project?.id, "Project creation response did not include a project id.");

  step("Creating a support escalation record");
  const supportResponse = await appFetch(baseUrl, "/api/support/requests", {
    method: "POST",
    cookie: ownerCookie,
    json: {
      projectId: project.id,
      requestType: "support",
      priority: "normal",
      subject: `Production smoke ${runId}`,
      message: "Smoke verification record for commercial support readiness.",
    },
  });
  assert(supportResponse.response.ok, `Support request failed: ${JSON.stringify(supportResponse.body)}`);

  step("Uploading a trace file and enqueueing live processing");
  const uploadResponse = await uploadTrace(baseUrl, ownerCookie, project.id, "production-smoke.csv");
  assert(uploadResponse.response.ok, `Trace upload failed: ${JSON.stringify(uploadResponse.body)}`);
  const traceImportId = uploadResponse.body.data.importRecord.id;
  const jobId = uploadResponse.body.data.job.id;

  step("Polling until Inngest completes processing");
  const state = await pollProjectState(baseUrl, ownerCookie, project.id, traceImportId, jobId);
  const job = state.processingJobs.find((item) => item.id === jobId);
  const traceImport = state.traceImports.find((item) => item.id === traceImportId);
  assert(traceImport?.status === "completed", "Trace import did not complete.");
  assert(job?.status === "completed", "Processing job did not complete.");
  assert(job.metadata?.generation?.provider === "openai", "Processing job did not record OpenAI generation.");
  assert(Boolean(job.metadata?.generation?.responseId), "Processing job did not record an OpenAI response id.");
  assert(state.evalCases.length > 0, "No eval cases were generated.");
  assert(state.graders.length > 0, "No graders were generated.");
  assert(state.reports.length > 0, "No audit report was generated.");

  step("Verifying duplicate upload protection");
  const duplicateResponse = await uploadTrace(baseUrl, ownerCookie, project.id, "production-smoke-duplicate.csv");
  assert(duplicateResponse.response.status === 409, `Duplicate upload did not return 409: ${duplicateResponse.response.status}`);
  assert(duplicateResponse.body.error?.code === "duplicate_upload", "Duplicate upload did not return duplicate_upload.");

  step("Generating and downloading a PDF audit report");
  const exportResponse = await appFetch(baseUrl, `/api/projects/${project.id}/exports`, {
    method: "POST",
    cookie: ownerCookie,
    json: { type: "audit_report_pdf" },
  });
  assert(exportResponse.response.ok, `PDF export failed: ${JSON.stringify(exportResponse.body)}`);
  const pdfResponse = await fetch(`${baseUrl}/api/exports/${exportResponse.body.data.id}/download`, {
    headers: {
      cookie: ownerCookie,
    },
  });
  assert(pdfResponse.ok, `PDF download failed with ${pdfResponse.status}.`);
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  assert(Buffer.from(pdfBytes.slice(0, 5)).toString("utf8") === "%PDF-", "PDF download did not start with %PDF-.");

  step("Generating and downloading a full project JSON export");
  const fullExportResponse = await appFetch(baseUrl, `/api/projects/${project.id}/exports`, {
    method: "POST",
    cookie: ownerCookie,
    json: { type: "full_project_json" },
  });
  assert(fullExportResponse.response.ok, `Full project JSON export failed: ${JSON.stringify(fullExportResponse.body)}`);
  const fullExportId = fullExportResponse.body.data?.id;
  assert(fullExportId, "Full project JSON export response did not include an export id.");
  await pollFullProjectExport(baseUrl, ownerCookie, project.id, fullExportId);
  const fullExportDownload = await fetch(`${baseUrl}/api/exports/${fullExportId}/download`, {
    headers: {
      cookie: ownerCookie,
    },
  });
  assert(fullExportDownload.ok, `Full project JSON download failed with ${fullExportDownload.status}.`);
  const fullProjectPackage = await fullExportDownload.json();
  assert(fullProjectPackage.manifest?.projectId === project.id, "Full export manifest did not match the smoke project id.");
  assert(fullProjectPackage.dataInventory?.rawUploads?.count === 1, "Full export raw upload inventory did not report one upload.");
  assert(
    fullProjectPackage.records?.evalCases?.length === state.evalCases.length,
    "Full export eval case records did not match generated project state.",
  );

  step("Verifying live Supabase RLS and storage isolation");
  await verifyRls({ owner, outsider, projectId: project.id, state });

  step("Deleting the smoke project and verifying the deletion receipt");
  const deleteResponse = await appFetch(baseUrl, `/api/projects/${project.id}`, {
    method: "DELETE",
    cookie: ownerCookie,
    json: { confirmationName: project.name },
  });
  assert(deleteResponse.response.ok, `Project deletion failed: ${JSON.stringify(deleteResponse.body)}`);
  assert(deleteResponse.body.data?.operation === "project_delete", "Project deletion did not return a project_delete receipt.");
  assert(deleteResponse.body.data?.id, "Project deletion response did not include a receipt id.");
  await pollProjectDeleted(baseUrl, ownerCookie, project.id, deleteResponse.body.data.id);

  step(`Production smoke passed for project ${project.id}`);
}

function assertRequiredEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required smoke env vars: ${missing.join(", ")}`);
  }
}

async function signIn(email, password) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Supabase sign-in failed for configured smoke user: ${error?.message || "missing session"}`);
  }
  return { client, session: data.session };
}

function sessionCookie(session) {
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const storageKey = `sb-${supabaseUrl.hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  return createCookieChunks(storageKey, value)
    .map(({ name, value: chunkValue }) => `${name}=${chunkValue}`)
    .join("; ");
}

function createCookieChunks(name, value) {
  const maxChunkSize = 3180;
  const encoded = encodeURIComponent(value);
  if (encoded.length <= maxChunkSize) return [{ name, value }];
  const chunks = [];
  let remaining = encoded;
  while (remaining.length > 0) {
    let encodedHead = remaining.slice(0, maxChunkSize);
    const lastEscapePos = encodedHead.lastIndexOf("%");
    if (lastEscapePos > maxChunkSize - 3) {
      encodedHead = encodedHead.slice(0, lastEscapePos);
    }
    let valueHead = "";
    while (encodedHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedHead);
        break;
      } catch (error) {
        if (error instanceof URIError && encodedHead.at(-3) === "%" && encodedHead.length > 3) {
          encodedHead = encodedHead.slice(0, encodedHead.length - 3);
        } else {
          throw error;
        }
      }
    }
    chunks.push(valueHead);
    remaining = remaining.slice(encodedHead.length);
  }
  return chunks.map((chunk, index) => ({ name: `${name}.${index}`, value: chunk }));
}

async function uploadTrace(baseUrl, cookie, projectId, fileName) {
  const form = new FormData();
  form.append("file", new File([TRACE_FILE_TEXT], fileName, { type: "text/csv" }));
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/imports`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  return { response, body: await safeJson(response) };
}

async function pollProjectState(baseUrl, cookie, projectId, traceImportId, jobId) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const stateResponse = await appFetch(baseUrl, `/api/app-state?projectId=${encodeURIComponent(projectId)}`, {
      cookie,
    });
    assert(stateResponse.response.ok, `App state request failed: ${JSON.stringify(stateResponse.body)}`);
    lastState = stateResponse.body.data;
    const traceImport = lastState.traceImports.find((item) => item.id === traceImportId);
    const job = lastState.processingJobs.find((item) => item.id === jobId);
    if (traceImport?.status === "completed" && job?.status === "completed") {
      return lastState;
    }
    if (traceImport?.status === "failed" || job?.status === "failed") {
      throw new Error(`Processing failed: ${job?.errorMessage || "unknown processing error"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for processing to complete. Last state: ${JSON.stringify(lastState)}`);
}

async function pollFullProjectExport(baseUrl, cookie, projectId, exportId) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const stateResponse = await appFetch(baseUrl, `/api/app-state?projectId=${encodeURIComponent(projectId)}`, {
      cookie,
    });
    assert(stateResponse.response.ok, `Full export app state request failed: ${JSON.stringify(stateResponse.body)}`);
    lastState = stateResponse.body.data;
    const exportRecord = lastState.exports.find((item) => item.id === exportId);
    const receipt = lastState.dataOperationReceipts.find((item) => item.exportId === exportId);
    if (exportRecord?.status === "generated" && receipt?.status === "completed") {
      return { state: lastState, exportRecord, receipt };
    }
    if (exportRecord?.status === "failed" || receipt?.status === "failed") {
      throw new Error(`Full project export failed: ${receipt?.summary || "unknown export error"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for full project export. Last state: ${JSON.stringify(lastState)}`);
}

async function pollProjectDeleted(baseUrl, cookie, projectId, receiptId) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const stateResponse = await appFetch(baseUrl, "/api/app-state", {
      cookie,
    });
    assert(stateResponse.response.ok, `Post-delete app state request failed: ${JSON.stringify(stateResponse.body)}`);
    lastState = stateResponse.body.data;
    const projectDeleted = !lastState.projects.some((item) => item.id === projectId);
    const receipt = lastState.dataOperationReceipts.find((item) => item.id === receiptId);
    if (projectDeleted && receipt?.operation === "project_delete" && receipt.status === "completed" && receipt.projectId === projectId) {
      return { state: lastState, receipt };
    }
    if (receipt?.status === "failed") {
      throw new Error(`Project deletion failed after enqueue: ${receipt.summary || "unknown deletion error"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for project deletion. Last state: ${JSON.stringify(lastState)}`);
}

async function verifyRls({ owner, outsider, projectId, state }) {
  const ownerProject = await owner.client.from("projects").select("id").eq("id", projectId);
  assert(!ownerProject.error, `Owner project query failed: ${ownerProject.error?.message}`);
  assert(ownerProject.data?.length === 1, "Owner could not read their own project through RLS.");

  const outsiderProject = await outsider.client.from("projects").select("id").eq("id", projectId);
  assert(!outsiderProject.error, `Outsider project query errored instead of being filtered: ${outsiderProject.error?.message}`);
  assert(outsiderProject.data?.length === 0, "Outsider could read the owner smoke project.");

  const ownerTraceImport = await owner.client.from("trace_imports").select("id").eq("project_id", projectId);
  assert(!ownerTraceImport.error, `Owner trace import query failed: ${ownerTraceImport.error?.message}`);
  assert(ownerTraceImport.data?.length > 0, "Owner could not read their trace imports through RLS.");

  const outsiderTraceImport = await outsider.client.from("trace_imports").select("id").eq("project_id", projectId);
  assert(!outsiderTraceImport.error, `Outsider trace import query errored: ${outsiderTraceImport.error?.message}`);
  assert(outsiderTraceImport.data?.length === 0, "Outsider could read owner trace imports.");

  const uploadedFile = state.uploadedFiles.find((item) => item.projectId === projectId);
  assert(uploadedFile, "Smoke state did not include an uploaded file.");
  const ownerDownload = await owner.client.storage
    .from(uploadedFile.storageBucket)
    .download(uploadedFile.storagePath);
  assert(!ownerDownload.error && ownerDownload.data, `Owner could not download uploaded trace: ${ownerDownload.error?.message}`);

  const outsiderDownload = await outsider.client.storage
    .from(uploadedFile.storageBucket)
    .download(uploadedFile.storagePath);
  assert(outsiderDownload.error, "Outsider could download owner storage object.");
}

async function appFetch(baseUrl, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.cookie) headers.set("cookie", options.cookie);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });
  return { response, body: await safeJson(response) };
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function step(message) {
  console.log(`[smoke] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
