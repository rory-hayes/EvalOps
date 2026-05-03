import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";
import { logServerEvent } from "./logger";

export async function handleApi<T>(handler: (correlationId: string) => Promise<T>) {
  const correlationId = randomUUID();
  try {
    const data = await handler(correlationId);
    return withCorrelationId(NextResponse.json({ ok: true, data, correlationId }), correlationId);
  } catch (error) {
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 500;
    const code =
      error instanceof ApiError
        ? error.code
        : error instanceof ZodError
          ? "validation_error"
          : "internal_error";
    const message =
      error instanceof ZodError
        ? "Request validation failed."
        : error instanceof Error
          ? error.message
          : "Unexpected server error.";

    if (status >= 500) {
      logServerEvent("error", "api.request.failed", { correlationId, code, message, status });
    }

    return withCorrelationId(NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
          correlationId,
          issues: error instanceof ZodError ? error.issues : undefined,
        },
      },
      { status },
    ), correlationId);
  }
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "invalid_json");
  }
}

export function csvResponse(content: string, fileName: string) {
  return new Response(content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
  });
}

export function downloadResponse(content: string | Uint8Array, fileName: string, contentType: string) {
  let body: BodyInit;
  if (typeof content === "string") {
    body = content;
  } else {
    const arrayBuffer = new ArrayBuffer(content.byteLength);
    new Uint8Array(arrayBuffer).set(content);
    body = new Blob([arrayBuffer], { type: contentType });
  }
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
  });
}

function withCorrelationId(response: NextResponse, correlationId: string) {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}
