import { useEffect, useMemo, useRef, useState } from "react";

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

function connectorPath(parent: StoryNode, child: StoryNode) {
  const startX = parent.x + NODE_WIDTH;
  const startY = parent.y + NODE_HEIGHT / 2;
  const endX = child.x;
  const endY = child.y + NODE_HEIGHT / 2;
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
  const [zoom, setZoom] = useState(0.52);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const lastFocusedCurrentNodeRef = useRef("");

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
  ) {
    const viewport = mapViewportRef.current;
    const node = nodeById.get(nodeId);

    if (!viewport || !node) return;

    viewport.scrollTo({
      left:
        (node.x + NODE_WIDTH / 2) * zoom
        - viewport.clientWidth / 2,
      top:
        (node.y + NODE_HEIGHT / 2) * zoom
        - viewport.clientHeight / 2,
      behavior,
    });
  }

  function focusCurrentNode() {
    if (!story) return;

    setSelectedNodeId(story.current_node_id);
    scrollToNode(story.current_node_id);
  }

  function fitRelationshipWeb() {
    const viewport = mapViewportRef.current;

    if (!story || !viewport) return;

    const nextZoom = Math.min(
      0.92,
      Math.max(
        0.32,
        Math.min(
          (viewport.clientWidth - 36) / story.graph.width,
          (viewport.clientHeight - 36) / story.graph.height,
        ),
      ),
    );

    setZoom(nextZoom);
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

            <div className="story-toolbar">
              <div className="story-legend" aria-label="Легенда">
                <span><i className="is-current" /> Текущий момент</span>
                <span><i className="is-lived" /> Прожито</span>
                <span><i className="is-signal" /> Обнаружено</span>
                <span><i className="is-closed" /> Неизвестно</span>
              </div>

              <div className="story-zoom">
                <button
                  type="button"
                  aria-label="Уменьшить масштаб"
                  onClick={() => setZoom((value) => Math.max(0.32, value - 0.1))}
                >
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Увеличить масштаб"
                  onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))}
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

            <div className="story-map-viewport" ref={mapViewportRef}>
              <div
                className="story-map-spacer"
                style={{
                  width: story.graph.width * zoom,
                  height: story.graph.height * zoom,
                }}
              >
                <div
                  className="story-graph"
                  style={{
                    width: story.graph.width,
                    height: story.graph.height,
                    transform: `scale(${zoom})`,
                  }}
                >
                  <svg
                    className="story-connectors"
                    width={story.graph.width}
                    height={story.graph.height}
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
                      ].join(" ")}
                      style={{ left: node.x, top: node.y }}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <span className="story-node__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="story-node__copy">
                        <strong>{node.title}</strong>
                        <small>{node.subtitle}</small>
                      </span>
                      <i aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="story-inspector">
              <section>
                <span className="story-kicker">
                  {selectedNode ? STATUS_LABELS[selectedNode.status] : "NODE"}
                </span>
                <h2>{selectedNode?.title ?? "Фрагмент не выбран"}</h2>
                <p>
                  {selectedNode?.description ??
                    "Выберите узел на схеме, чтобы увидеть его состояние."}
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
