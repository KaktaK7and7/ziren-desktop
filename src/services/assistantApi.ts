const ASSISTANT_API_URL = "http://127.0.0.1:8787";

export type AssistantStatus = {
  running: boolean;
  listening: boolean;
  mode: string;
};

export async function getAssistantStatus(): Promise<AssistantStatus> {
  const response = await fetch(`${ASSISTANT_API_URL}/status`);

  if (!response.ok) {
    throw new Error("Assistant status request failed");
  }

  return response.json();
}

export async function toggleAssistantListening(): Promise<AssistantStatus> {
  const response = await fetch(`${ASSISTANT_API_URL}/listening/toggle`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Assistant toggle request failed");
  }

  return response.json();
}

export async function enableAssistantListening(): Promise<AssistantStatus> {
  const response = await fetch(`${ASSISTANT_API_URL}/listening/enable`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Assistant enable request failed");
  }

  return response.json();
}

export async function disableAssistantListening(): Promise<AssistantStatus> {
  const response = await fetch(`${ASSISTANT_API_URL}/listening/disable`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Assistant disable request failed");
  }

  return response.json();
}