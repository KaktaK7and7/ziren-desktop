import { fetchAssistantApi } from "./localApi";


export type DrawingKind = "sketch" | "technical" | "story" | "screen";

export type MelissaDrawing = {
  id: string;
  title: string;
  kind: DrawingKind;
  story_relevant: boolean;
  description: string;
  completion_line: string;
  created_at: string;
  mime_type: "image/png";
  model: string;
  sha256: string;
  thumbnail_data_url: string;
  image_data_url?: string;
};


async function readDrawingResponse(response: Response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Локальная библиотека вернула HTTP " + response.status,
    );
  }

  return data;
}


export async function fetchDrawings(): Promise<MelissaDrawing[]> {
  const response = await fetchAssistantApi("/drawings");
  const data = await readDrawingResponse(response);
  return Array.isArray(data?.drawings) ? data.drawings : [];
}


export async function fetchDrawing(
  drawingId: string,
): Promise<MelissaDrawing> {
  const response = await fetchAssistantApi(
    "/drawings/" + encodeURIComponent(drawingId),
  );
  const data = await readDrawingResponse(response);

  if (!data?.drawing || typeof data.drawing !== "object") {
    throw new Error("Рисунок не найден в локальной библиотеке");
  }

  return data.drawing as MelissaDrawing;
}
