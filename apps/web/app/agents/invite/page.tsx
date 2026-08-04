"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import type { Agent, AgentRole, InviteAgentResponse } from "@messages/shared-types";
import { apiFetch } from "../../../lib/api";

export default function InviteAgentPage() {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AgentRole>("member");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const { agent } = await apiFetch<{ agent: Agent }>("/agents/me", token);
      setAgent(agent);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invite() {
    if (!agent?.organizationId) return;
    const token = await getToken();
    const result = await apiFetch<InviteAgentResponse>(
      `/organizations/${agent.organizationId}/agents/invite`,
      token,
      { method: "POST", body: JSON.stringify({ email, role }) },
    );
    setStatus(`Invite sent (id: ${result.inviteId})`);
  }

  return (
    <main>
      <h1>Invite an agent</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value as AgentRole)}>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button disabled={!agent} onClick={() => void invite()}>
        Send invite
      </button>
      {status && <p>{status}</p>}
    </main>
  );
}
