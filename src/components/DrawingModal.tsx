import { useEffect, useState } from "react";

import {
  fetchDrawing,
  fetchDrawings,
  type MelissaDrawing,
} from "../services/drawings";

import "./DrawingModal.css";


type Props = {
  initialDrawingId?: string;
  onClose: () => void;
};

const KIND_LABELS: Record<MelissaDrawing["kind"], string> = {
  sketch: "Свободный набросок",
  technical: "Технический концепт",
  story: "Фрагмент связи",
};


function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "дата неизвестна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


export default function DrawingModal({
  initialDrawingId = "",
  onClose,
}: Props) {
  const [drawings, setDrawings] = useState<MelissaDrawing[]>([]);
  const [selectedId, setSelectedId] = useState(initialDrawingId);
  const [selectedDrawing, setSelectedDrawing] =
    useState<MelissaDrawing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawingLoading, setIsDrawingLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLibrary() {
    try {
      setError("");
      setIsLoading(true);
      const loaded = await fetchDrawings();
      setDrawings(loaded);
      setSelectedId((current) => {
        if (loaded.some((drawing) => drawing.id === current)) {
          return current;
        }

        return loaded[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось открыть локальную библиотеку",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDrawing(null);
      return;
    }

    let active = true;
    setIsDrawingLoading(true);

    fetchDrawing(selectedId)
      .then((drawing) => {
        if (active) {
          setSelectedDrawing(drawing);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить рисунок",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsDrawingLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  return (
    <div className="drawing-overlay" role="dialog" aria-modal="true">
      <div className="drawing-paper-noise" />
      <section className="drawing-shell">
        <header className="drawing-header">
          <div>
            <span>MELISSA // LOCAL SKETCH ARCHIVE</span>
            <h1>Холст Мелиссы</h1>
            <p>Личная библиотека хранится на этом компьютере.</p>
          </div>
          <div className="drawing-header__actions">
            <button type="button" onClick={() => void loadLibrary()}>
              Обновить
            </button>
            <button type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        {error && (
          <div className="drawing-error">
            <span>{error}</span>
            <button type="button" onClick={() => void loadLibrary()}>
              Повторить
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="drawing-empty">Проверяю папку с набросками…</div>
        ) : drawings.length === 0 ? (
          <div className="drawing-empty">
            <strong>Здесь пока чистый лист.</strong>
            <p>
              Скажи, например: «Мелисса, нарисуй чертёж робо-руки
              манипулятора». Она ответит сразу, а готовый набросок появится
              здесь отдельным уведомлением.
            </p>
          </div>
        ) : (
          <div className="drawing-workspace">
            <div className="drawing-canvas">
              {isDrawingLoading && (
                <div className="drawing-canvas__loading">
                  Разворачиваю лист…
                </div>
              )}

              {selectedDrawing?.image_data_url && (
                <img
                  src={selectedDrawing.image_data_url}
                  alt={selectedDrawing.title}
                />
              )}
            </div>

            <aside className="drawing-inspector">
              {selectedDrawing && (
                <>
                  <div className="drawing-tags">
                    <span>{KIND_LABELS[selectedDrawing.kind]}</span>
                    {selectedDrawing.story_relevant && (
                      <span className="is-story">Связано с Хроникой</span>
                    )}
                  </div>
                  <h2>{selectedDrawing.title}</h2>
                  <time>{formatCreatedAt(selectedDrawing.created_at)}</time>

                  {selectedDrawing.completion_line && (
                    <blockquote>
                      «{selectedDrawing.completion_line}»
                    </blockquote>
                  )}

                  <div className="drawing-description">
                    <span>Замысел</span>
                    <p>{selectedDrawing.description}</p>
                  </div>

                  {selectedDrawing.kind === "technical" && (
                    <div className="drawing-concept-warning">
                      Это концептуальный набросок. Перед изготовлением детали
                      нужно отдельно проверить размеры, нагрузки и безопасность.
                    </div>
                  )}
                </>
              )}
            </aside>

            <div className="drawing-library">
              <div className="drawing-library__heading">
                <span>Локальная библиотека</span>
                <strong>{drawings.length}</strong>
              </div>
              <div className="drawing-library__grid">
                {drawings.map((drawing) => (
                  <button
                    className={
                      drawing.id === selectedId ? "is-selected" : ""
                    }
                    key={drawing.id}
                    type="button"
                    onClick={() => setSelectedId(drawing.id)}
                  >
                    <img
                      src={drawing.thumbnail_data_url}
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{drawing.title}</span>
                    <small>{KIND_LABELS[drawing.kind]}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
