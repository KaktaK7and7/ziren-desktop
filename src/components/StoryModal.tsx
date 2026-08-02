import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchMelissaStory,
  type MelissaStory,
  type StoryNode,
} from "../services/story";

import "./StoryModal.css";

type Props = {
  onClose: () => void;
};

const NODE_WIDTH = 190;
const NODE_HEIGHT = 82;
const EXPANDED_NODE_WIDTH = 360;
const EXPANDED_NODE_HEIGHT = 176;
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.2;
const MAP_PADDING = 240;
const FOCUS_ZOOM = 0.82;

const STATUS_LABELS: Record<StoryNode["status"], string> = {
  active: "разговор продолжается",
  available: "решение формируется",
  unlocked: "прожито",
  discovered: "обнаружен сигнал",
  hidden: "неизвестно",
  missed: "непрожитый путь",
};

function relationshipLabel(value: number) {
  if (value >= 5) return "устойчивая";
  if (value >= 3) return "формируется";
  if (value >= 1) return "первый сигнал";
  return "не определено";
}

function relationshipWidth(value: number) {
  return `${Math.min(100, Math.round((value / 8) * 100))}%`;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function connectorPath(parent: StoryNode, child: StoryNode) {
  const startX = parent.x + MAP_PADDING + NODE_WIDTH;
  const startY = parent.y + MAP_PADDING + NODE_HEIGHT / 2;
  const endX = child.x + MAP_PADDING;
  const endY = child.y + MAP_PADDING + NODE_HEIGHT / 2;
  const bend = Math.max(44, (endX - startX) * 0.46);

  return [
    `M ${startX} ${startY}`,
    `C ${startX + bend} ${startY},`,
    `${endX - bend} ${endY},`,
    `${endX} ${endY}`,
  ].join(" ");
}

export default function StoryModal({ onClose }: Props) {
  const [story, setStory] = useState<MelissaStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [expandedNodeId, setExpandedNodeId] = useState("");
  const [zoom, setZoom] = useState(0.52);
  const [isPanning, setIsPanning] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const lastFocusedCurrentNodeRef = useRef("");
  const zoomRef = useRef(0.52);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const unlockedCount = useMemo(
    () =>
      story?.nodes.filter((node) =>
        ["unlocked", "active", "available"].includes(node.status)
      ).length ?? 0,
    [story],
  );

  const nodeById = useMemo(
    () => new Map(story?.nodes.map((node) => [node.id, node]) ?? []),
    [story],
  );

  const selectedNode =
    nodeById.get(selectedNodeId) ??
    nodeById.get(story?.current_node_id ?? "") ??
    story?.nodes[0] ??
    null;

  const guidance = story?.guidance ?? {
    status: "active" as const,
    step: story?.prologue.step || 1,
    total_steps: story?.prologue.total_steps || 4,
    title: "Продолжите текущий разговор",
    objective:
      story?.dialogue.next_prompt?.prompt
      || "Говорите с компаньоном своими словами — решение сохранится в Хронике.",
    why: "Специальная команда или выбор карточки не требуется.",
    suggestions: ["Спросить, что она предлагает сделать дальше"],
    completion_rule: "Ответьте своими словами в обычном диалоге.",
    melissa_leads: true,
    stalled: false,
    turns_since_progress: 0,
  };

  async function loadStory(showLoading = false) {
    try {
      setError("");

      if (showLoading) {
        setIsLoading(true);
      }

      const loadedStory = await fetchMelissaStory();
      setStory(loadedStory);
      setSelectedNodeId((current) =>
        loadedStory.nodes.some((node) => node.id === current)
          ? current
          : loadedStory.current_node_id,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить Хронику связи",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStory(true);

    const intervalId = window.setInterval(() => {
      void loadStory();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      !story
      || story.current_node_id === lastFocusedCurrentNodeRef.current
    ) {
      return;
    }

    lastFocusedCurrentNodeRef.current = story.current_node_id;
    const animationFrame = window.requestAnimationFrame(() => {
      scrollToNode(story.current_node_id, "smooth");
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [story?.current_node_id]);

  function scrollToNode(
    nodeId: string,
    behavior: ScrollBehavior = "smooth",
    expanded = expandedNodeId === nodeId,
  ) {
    const viewport = mapViewportRef.current;
    const node = nodeById.get(nodeId);

    if (!viewport || !node) return;

    const nodeWidth = expanded ? EXPANDED_NODE_WIDTH : NODE_WIDTH;
    const nodeHeight = expanded ? EXPANDED_NODE_HEIGHT : NODE_HEIGHT;

    viewport.scrollTo({
      left:
        (node.x + MAP_PADDING + nodeWidth / 2) * zoomRef.current
        - viewport.clientWidth / 2,
      top:
        (node.y + MAP_PADDING + nodeHeight / 2) * zoomRef.current
        - viewport.clientHeight / 2,
      behavior,
    });
  }

  function focusCurrentNode() {
    if (!story) return;

    const nextZoom = Math.max(zoomRef.current, FOCUS_ZOOM);

    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    setSelectedNodeId(story.current_node_id);
    setExpandedNodeId(story.current_node_id);
    window.requestAnimationFrame(() => {
      scrollToNode(story.current_node_id, "smooth", true);
    });
  }

  function openNode(nodeId: string) {
    const shouldExpand = expandedNodeId !== nodeId;

    setSelectedNodeId(nodeId);
    setExpandedNodeId(shouldExpand ? nodeId : "");

    if (shouldExpand) {
      window.requestAnimationFrame(() => {
        scrollToNode(nodeId, "smooth", true);
      });
    }
  }

  function setMapZoom(
    nextZoomValue: number,
    anchorX?: number,
    anchorY?: number,
  ) {
    const viewport = mapViewportRef.current;
    const nextZoom = clampZoom(nextZoomValue);
    const previousZoom = zoomRef.current;

    if (!viewport || nextZoom === previousZoom) return;

    const viewportX = anchorX ?? viewport.clientWidth / 2;
    const viewportY = anchorY ?? viewport.clientHeight / 2;
    const graphX = (viewport.scrollLeft + viewportX) / previousZoom;
    const graphY = (viewport.scrollTop + viewportY) / previousZoom;

    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      viewport.scrollTo({
        left: graphX * nextZoom - viewportX,
        top: graphY * nextZoom - viewportY,
        behavior: "auto",
      });
    });
  }

  function handleMapWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = event.deltaY < 0 ? 1 : -1;
    setMapZoom(
      zoomRef.current + direction * 0.08,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  }

  function handlePanStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0
      || (event.target as HTMLElement).closest("button")
    ) {
      return;
    }

    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handlePanMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;

    if (!pan || pan.pointerId !== event.pointerId) return;

    event.currentTarget.scrollLeft =
      pan.scrollLeft - (event.clientX - pan.startX);
    event.currentTarget.scrollTop =
      pan.scrollTop - (event.clientY - pan.startY);
  }

  function handlePanEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;

    if (!pan || pan.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panRef.current = null;
    setIsPanning(false);
  }

  function fitRelationshipWeb() {
    const viewport = mapViewportRef.current;

    if (!story || !viewport) return;

    const nextZoom = Math.min(
      0.92,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (viewport.clientWidth - 36) / (story.graph.width + MAP_PADDING * 2),
          (viewport.clientHeight - 36) / (story.graph.height + MAP_PADDING * 2),
        ),
      ),
    );

    setZoom(nextZoom);
    zoomRef.current = nextZoom;
    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="story-overlay" role="dialog" aria-modal="true">
      <div className="story-noise" aria-hidden="true" />

      <section className="story-shell">
        <header className="story-header">
          <div>
            <span className="story-kicker">ZIREN // MEMORY LINK</span>
            <h1>Хроника связи</h1>
          </div>

          <div className="story-header__actions">
            <button type="button" onClick={() => void loadStory(true)}>
              Обновить
            </button>
            <button className="story-close" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        {isLoading && (
          <div className="story-loading">
            <span />
            Синхронизация фрагментов…
          </div>
        )}

        {error && (
          <div className="story-error">
            <span>{error}</span>
            <button type="button" onClick={() => void loadStory(true)}>
              Повторить
            </button>
          </div>
        )}

        {story && (
          <div className="story-console">
            <div className="story-season">
              <div>
                <span>LIVING STORY</span>
                <strong>
                  {story.story_mode.enabled
                    ? `${story.story_mode.label} · активна`
                    : "Режим отключён"}
                </strong>
              </div>
              <div>
                <span>CURRENT PATH</span>
                <strong>{story.path.title} · {story.path.stance}</strong>
              </div>
              <div>
                <span>COMPANION</span>
                <strong>{story.companion_name}</strong>
              </div>
              <div>
                <span>CONNECTION MAP</span>
                <strong>{unlockedCount} узлов прожито</strong>
              </div>
            </div>

            <section
              className={[
                "story-guidance-panel",
                guidance.stalled ? "is-stalled" : "",
              ].join(" ")}
            >
              <div className="story-guidance-panel__heading">
                <span className="story-kicker">
                  {guidance.status === "open_world"
                    ? "СВОБОДНОЕ РАЗВИТИЕ"
                    : `ШАГ ${guidance.step} ИЗ ${guidance.total_steps}`}
                </span>
                <h2>{guidance.title}</h2>
                <small>{guidance.completion_rule}</small>
              </div>
              <div className="story-guidance-panel__objective">
                <strong>Что делать сейчас</strong>
                <p>{guidance.objective}</p>
                <small>{guidance.why}</small>
              </div>
              <div className="story-guidance-panel__suggestions">
                <strong>Можно начать своими словами</strong>
                <ul>
                  {guidance.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
              {guidance.stalled && (
                <div className="story-guidance-panel__alert">
                  Связь застыла. Теперь {story.companion_name} должна сама
                  предложить действие, потребовать решение или возразить.
                </div>
              )}
            </section>

            <div className="story-toolbar">
              <div className="story-legend" aria-label="Легенда">
                <span><i className="is-current" /> Текущий момент</span>
                <span><i className="is-lived" /> Прожито</span>
                <span><i className="is-signal" /> Обнаружено</span>
                <span><i className="is-closed" /> Неизвестно</span>
                <span className="story-navigation-hint">
                  Колесо — масштаб · потяни фон — перемещение
                </span>
              </div>

              <div className="story-zoom">
                <button
                  type="button"
                  aria-label="Уменьшить масштаб"
                  onClick={() => setMapZoom(zoomRef.current - 0.1)}
                >
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Увеличить масштаб"
                  onClick={() => setMapZoom(zoomRef.current + 0.1)}
                >
                  +
                </button>
                <button type="button" onClick={focusCurrentNode}>
                  Текущий узел
                </button>
                <button type="button" onClick={fitRelationshipWeb}>
                  Вся паутина
                </button>
              </div>
            </div>

            <div
              className={[
                "story-map-viewport",
                isPanning ? "is-panning" : "",
              ].join(" ")}
              ref={mapViewportRef}
              onWheel={handleMapWheel}
              onPointerDown={handlePanStart}
              onPointerMove={handlePanMove}
              onPointerUp={handlePanEnd}
              onPointerCancel={handlePanEnd}
            >
              <div
                className="story-map-spacer"
                style={{
                  width: (story.graph.width + MAP_PADDING * 2) * zoom,
                  height: (story.graph.height + MAP_PADDING * 2) * zoom,
                }}
              >
                <div
                  className="story-graph"
                  style={{
                    width: story.graph.width + MAP_PADDING * 2,
                    height: story.graph.height + MAP_PADDING * 2,
                    transform: `scale(${zoom})`,
                  }}
                >
                  <svg
                    className="story-connectors"
                    width={story.graph.width + MAP_PADDING * 2}
                    height={story.graph.height + MAP_PADDING * 2}
                    aria-hidden="true"
                  >
                    {story.nodes.flatMap((node) =>
                      node.parent_ids.map((parentId) => {
                        const parent = nodeById.get(parentId);

                        if (!parent) return null;

                        return (
                          <path
                            key={`${parentId}-${node.id}`}
                            d={connectorPath(parent, node)}
                            className={[
                              "story-connector",
                              `story-connector--${node.status}`,
                            ].join(" ")}
                          />
                        );
                      }),
                    )}
                  </svg>

                  {story.nodes.map((node, index) => (
                    <button
                      type="button"
                      key={node.id}
                      data-story-node={node.id}
                      className={[
                        "story-node",
                        `story-node--${node.status}`,
                        selectedNode?.id === node.id ? "is-selected" : "",
                        expandedNodeId === node.id ? "is-expanded" : "",
                      ].join(" ")}
                      style={{
                        left: node.x + MAP_PADDING,
                        top: node.y + MAP_PADDING,
                      }}
                      aria-expanded={expandedNodeId === node.id}
                      onClick={() => openNode(node.id)}
                    >
                      <span className="story-node__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="story-node__copy">
                        <strong>{node.title}</strong>
                        <small>{node.subtitle}</small>
                      </span>
                      <i aria-hidden="true" />
                      <span className="story-node__details">
                        <b>{STATUS_LABELS[node.status]}</b>
                        <span>{node.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="story-inspector">
              <section>
                <span className="story-kicker">ТЕКУЩАЯ НИТЬ</span>
                <h2>{guidance.title}</h2>
                <p>
                  {guidance.objective} Решение принимается в обычном
                  разговоре — специальная фраза или кнопка не нужна.
                </p>
                <div className="story-path-note">
                  <strong>{story.path.title}</strong>
                  <span>{story.path.description}</span>
                </div>
                {story.dialogue.next_prompt && (
                  <div className="story-dialogue-hint">
                    <strong>Следующая связь формируется в разговоре</strong>
                    <span>
                      Здесь нет правильной кнопки: говори с {story.companion_name},
                      принимай решения своими словами, и схема сохранит то, что вы
                      действительно прожили.
                    </span>
                  </div>
                )}
              </section>

              <aside className="story-relationship">
                <h3>Состояние связи</h3>
                {(
                  [
                    ["Доверие", story.relationship.trust],
                    ["Близость", story.relationship.closeness],
                    ["Самостоятельность", story.relationship.autonomy],
                    ["Осторожность", story.relationship.caution],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <span>
                      {label}
                      <small>{relationshipLabel(value)}</small>
                    </span>
                    <div>
                      <i style={{ width: relationshipWidth(value) }} />
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
