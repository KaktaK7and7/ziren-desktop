import { fetchAssistantApi } from "./localApi";


export type ScreenAnnotation = {
  id: string;
  label: string;
  kind: "target" | "step" | "text" | "warning";
  x: number;
  y: number;
  width: number;
  height: number;
  step: number;
};

export type ScreenGuidance = {
  id: string;
  answer: string;
  mode: "explain" | "translate" | "guide" | "annotate";
  annotations: ScreenAnnotation[];
  action: {
    type: "none" | "click";
    available: boolean;
    requested: boolean;
    label: string;
    risk: "safe" | "blocked";
    reason: string;
    expires_in_seconds?: number;
  };
  canvas_available: boolean;
  capture: {
    width: number;
    height: number;
    one_shot: boolean;
  };
};

export type ScreenGuidanceAction = {
  analysisId: string;
  action: "confirm" | "canvas" | "dismiss";
};


async function postScreenAction(
  analysisId: string,
  operation: string,
  body: Record<string, unknown>,
) {
  const response = await fetchAssistantApi(
    `/screen/analyses/${encodeURIComponent(analysisId)}/${operation}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `HTTP ${response.status}`,
    );
  }

  return data;
}


export function confirmScreenClick(analysisId: string) {
  return postScreenAction(
    analysisId,
    "confirm",
    { confirmed: true },
  );
}


export function saveScreenToCanvas(analysisId: string) {
  return postScreenAction(
    analysisId,
    "canvas",
    { save: true },
  );
}


export function dismissScreenGuidance(analysisId: string) {
  return postScreenAction(
    analysisId,
    "dismiss",
    { dismiss: true },
  );
}
