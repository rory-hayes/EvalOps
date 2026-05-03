import { type NextRequest } from "next/server";
import { getActorFromRequest } from "@/lib/server/auth";
import { handleApi, readJsonBody } from "@/lib/server/api";
import { createSupportRequestSchema } from "@/lib/server/schemas";
import { getEvalOpsStore } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const actor = await getActorFromRequest(request);
    const input = createSupportRequestSchema.parse(await readJsonBody(request));
    const store = await getEvalOpsStore();
    return store.createSupportRequest(actor, input);
  });
}
