"use client";

import { useAuth } from "@clerk/nextjs";
import type { Organization } from "@messages/shared-types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function OrganizationsQueuePage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<Organization["approvalStatus"] | "">("pending");
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  async function refresh() {
    const token = await getToken();
    const query = status ? `?status=${status}` : "";
    const { organizations } = await apiFetch<{ organizations: Organization[] }>(
      `/admin/organizations${query}`,
      token,
    );
    setOrganizations(organizations);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main>
      <h1>Organizations</h1>
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
            <Link href={`/organizations/${o.id}`}>{o.name}</Link> — {o.approvalStatus}
          </li>
        ))}
      </ul>
    </main>
  );
}
