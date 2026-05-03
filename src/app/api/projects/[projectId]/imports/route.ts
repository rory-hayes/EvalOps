import { type NextRequest } from "next/server";
import { ApiError, getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvalOpsStore } from "@/lib/server/store";
import {
  isSupportedTraceFile,
  normalizeTraceFileContentType,
} from "@/lib/domain/trace-processing";
import { assertAuditRuntimeConfigured, enqueueTraceImportProcessing } from "@/lib/workflows/audit-processor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const { projectId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Upload a CSV, JSON, NDJSON, or TXT file.", "missing_file");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new ApiError(413, "Files are limited to 50 MB for browser uploads.", "file_too_large");
    }
    if (!isSupportedTraceFile(file.name, file.type)) {
      throw new ApiError(400, "Unsupported file type. Use CSV, JSON, NDJSON, or TXT.", "unsupported_file_type");
    }
    assertAuditRuntimeConfigured();
    const contentType = normalizeTraceFileContentType(file.name, file.type);
    const text = await file.text();
    const store = await getEvalOpsStore();
    const queued = await store.createTraceImport(actor, {
      projectId,
      fileName: file.name,
      contentType,
      text,
    });
    await enqueueTraceImportProcessing({
      actor,
      projectId,
      traceImportId: queued.importRecord.id,
      jobId: queued.job.id,
    });
    return queued;
  });
}
