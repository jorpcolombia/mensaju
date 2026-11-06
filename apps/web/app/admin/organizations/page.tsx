"use client";

import { useAuth } from "@clerk/nextjs";
import type { Organization } from "@messages/shared-types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

export default function OrganizationsQueuePage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<Organization["approvalStatus"] | "">("pending");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const token = await getToken();
    const query = status ? `?status=${status}` : "";
    try {
      const { organizations } = await apiFetch<{ organizations: Organization[] }>(
        `/admin/organizations${query}`,
        token,
      );
      setOrganizations(organizations);
      setError(null);
    } catch (err) {
      setError(
        String(err).includes(" 403 ") ? "Your account is not an admin." : "Could not load organizations.",
      );
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main>
      <h1>Organizations</h1>
      {error && <p role="alert">{error}</p>}
      <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="suspended">Suspended</option>
      </select>
      <ul>
        {organizations.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/organizations/${o.id}`}>{o.name}</Link> — {o.approvalStatus}
          </li>
        ))}
      </ul>
    </main>
  );
}
