"use client";

import { useAuth } from "@clerk/nextjs";
import type {
  Agent,
  Organization,
  UpdateOrganizationProfileResponse,
} from "@messages/shared-types";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function OrganizationProfilePage() {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const { agent } = await apiFetch<{ agent: Agent }>("/agents/me", token);
      setAgent(agent);
      if (!agent.organizationId) return;
      const { organization } = await apiFetch<{ organization: Organization }>(
        `/organizations/${agent.organizationId}`,
        token,
      );
      setOrganization(organization);
      setName(organization.name);
      setDescription(organization.description ?? "");
      setWebsiteUrl(organization.websiteUrl ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!agent?.organizationId) return;
    const token = await getToken();
    const { organization } = await apiFetch<UpdateOrganizationProfileResponse>(
      `/organizations/${agent.organizationId}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ name, description, websiteUrl }),
      },
    );
    setOrganization(organization);
    setStatus("Saved");
  }

  if (!organization) return <main>Loading…</main>;

  return (
    <main>
      <h1>Organization profile</h1>
      <p>Status: {organization.approvalStatus}</p>

      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea
        placeholder="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="website URL"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
      />
      <button onClick={() => void save()}>Save</button>
      {status && <p>{status}</p>}
    </main>
  );
}
