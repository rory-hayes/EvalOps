import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi } from "@/lib/server/api";
import { getEvallerStore } from "@/lib/evaller/store";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    return getEvallerStore().listRuns(actor);
  });
}
