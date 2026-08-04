"use client";

import { useAuth } from "@clerk/nextjs";
import type { ApprovalAction, ApprovalAuditLogEntry, Organization } from "@messages/shared-types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [auditLog, setAuditLog] = useState<ApprovalAuditLogEntry[]>([]);
  const [note, setNote] = useState("");

  async function refresh() {
    const token = await getToken();
    const [{ organization }, { entries }] = await Promise.all([
      apiFetch<{ organization: Organization }>(`/admin/organizations/${id}`, token),
      apiFetch<{ entries: ApprovalAuditLogEntry[] }>(`/admin/organizations/${id}/audit-log`, token),
    ]);
    setOrganization(organization);
    setAuditLog(entries);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(action: ApprovalAction) {
    const token = await getToken();
    await apiFetch(`/admin/organizations/${id}/${action}`, token, {
      method: "POST",
      body: JSON.stringify({ note: note || undefined }),
    });
    setNote("");
    await refresh();
  }

  if (!organization) return <main>Loading…</main>;

  return (
    <main>
      <h1>{organization.name}</h1>
      <p>Status: {organization.approvalStatus}</p>

      <input placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div>
        <button onClick={() => void act("approve")}>Approve</button>
        <button onClick={() => void act("reject")}>Reject</button>
        <button onClick={() => void act("suspend")}>Suspend</button>
        <button onClick={() => void act("reinstate")}>Reinstate</button>
      </div>

      <h2>Audit log</h2>
      <ul>
        {auditLog.map((entry) => (
          <li key={entry.id}>
            {entry.createdAt}: {entry.previousStatus} → {entry.newStatus} ({entry.action})
            {entry.note ? ` — ${entry.note}` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
