import { type NextRequest } from "next/server";
import { csvResponse } from "@/lib/server/api";
import { getActorFromRequest } from "@/lib/server/auth";
import { getEvalOpsStore } from "@/lib/server/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const actor = await getActorFromRequest(request);
  const { exportId } = await params;
  const store = await getEvalOpsStore();
  const { record, content } = await store.getExport(actor, exportId);
  return csvResponse(content, record.fileName);
}
