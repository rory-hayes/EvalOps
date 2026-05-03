import { type NextRequest } from "next/server";
import { downloadResponse } from "@/lib/server/api";
import { ApiError, getActorFromRequest } from "@/lib/server/auth";
import { getEvalOpsStore } from "@/lib/server/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const actor = await getActorFromRequest(request);
  const { receiptId } = await params;
  const store = await getEvalOpsStore();
  const state = await store.getWorkspaceState(actor);
  const receipt = state.dataOperationReceipts.find((item) => item.id === receiptId);
  if (!receipt) {
    throw new ApiError(404, "Receipt not found for this organization.", "receipt_not_found");
  }

  const fileName = `${receipt.operation}-${receipt.id}.json`;
  const content = JSON.stringify({ receipt }, null, 2);
  return downloadResponse(content, fileName, "application/json; charset=utf-8");
}
