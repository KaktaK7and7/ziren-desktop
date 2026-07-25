import { fetchAssistantApi } from "./localApi";

export type AssistantEvent = {
  id: string;
  ts: string;
  type: string;
  level: "info" | "warn" | "error";
  payload: Record<string, unknown>;
};

export async function fetchAssistantEvents(): Promise<AssistantEvent[]> {
  const response = await fetchAssistantApi("/events");

  if (!response.ok) {
    throw new Error(`Assistant events request failed: ${response.status}`);
  }

  const data = await response.json();

  return data.events ?? [];
}
