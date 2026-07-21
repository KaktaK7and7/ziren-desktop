import { fetchAssistantApi } from "./localApi";

export type AssistantLog = {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  meta?: Record<string, unknown>;
};

export async function fetchAssistantLogs(): Promise<AssistantLog[]> {
  const response = await fetchAssistantApi("/logs");

  if (!response.ok) {
    throw new Error(`Assistant logs request failed: ${response.status}`);
  }

  const data = await response.json();

  return data.logs ?? [];
}
