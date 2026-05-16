export const ASSISTANT_API_URL = "http://127.0.0.1:8787";

export type AssistantEvent = {
  id: string;
  ts: string;
  type: string;
  level: "info" | "warn" | "error";
  payload: Record<string, unknown>;
};

export async function fetchAssistantEvents(): Promise<AssistantEvent[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/events`);

  if (!response.ok) {
    throw new Error(`Assistant events request failed: ${response.status}`);
  }

  const data = await response.json();

  return data.events ?? [];
}
