"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";

type ApiEnvelope<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string; correlationId: string } };

export function InviteAcceptance({ token }: { token: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function acceptInvite() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const payload = (await response.json()) as ApiEnvelope<{ organizationId: string; role: string }>;
      if (!payload.ok) throw new Error(payload.error.message);
      setStatus("Invitation accepted. Open the app to continue in the invited workspace.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <Button onClick={acceptInvite} disabled={busy}>
        {busy ? "Accepting..." : "Accept invitation"}
      </Button>
      {status ? <p className="mt-3 text-sm leading-6 text-slate-600">{status}</p> : null}
    </div>
  );
}
