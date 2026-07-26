import { useEffect, useMemo, useState } from "react";

import {
  fetchMelissaStory,
  recordMelissaStoryChoice,
  type MelissaStory,
  type StoryChoiceOption,
} from "../services/story";

import "./StoryModal.css";

type Props = {
  onClose: () => void;
};

function relationshipLabel(value: number) {
  if (value >= 5) return "устойчивая";
  if (value >= 3) return "формируется";
  if (value >= 1) return "первый сигнал";
  return "не определено";
}

function relationshipWidth(value: number) {
  return `${Math.min(100, Math.round((value / 6) * 100))}%`;
}

export default function StoryModal({ onClose }: Props) {
  const [story, setStory] = useState<MelissaStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedCustomOption, setSelectedCustomOption] =
    useState<StoryChoiceOption | null>(null);
  const [customName, setCustomName] = useState("");

  const unlockedCount = useMemo(
    () => story?.nodes.filter((node) => node.status === "unlocked").length ?? 0,
    [story],
  );

  async function loadStory() {
    try {
      setError("");
      setIsLoading(true);
      setStory(await fetchMelissaStory());
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
    void loadStory();
  }, []);

  async function submitChoice(
    option: StoryChoiceOption,
    name = "",
  ) {
    const choice = story?.prologue.next_choice;

    if (!choice || isSubmitting) return;

    if (option.requiresName && !name.trim()) {
      setSelectedCustomOption(option);
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      const updatedStory = await recordMelissaStoryChoice({
        choiceId: choice.id,
        optionId: option.id,
        customName: name,
      });
      setStory(updatedStory);
      setSelectedCustomOption(null);
      setCustomName("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить выбор",
      );
    } finally {
      setIsSubmitting(false);
    }
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

          <button className="story-close" type="button" onClick={onClose}>
            Закрыть
          </button>
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
            {!story && (
              <button type="button" onClick={() => void loadStory()}>
                Повторить
              </button>
            )}
          </div>
        )}

        {story && (
          <>
            <div className="story-season">
              <div>
                <span>ACTIVE STORY</span>
                <strong>{story.season.title}</strong>
              </div>
              <div>
                <span>COMPANION</span>
                <strong>{story.companion_name}</strong>
              </div>
              <div>
                <span>MEMORY</span>
                <strong>{unlockedCount} открыто</strong>
              </div>
            </div>

            <div className="story-layout">
              <div className="story-scene">
                {!story.prologue.completed && story.prologue.next_choice ? (
                  <>
                    <div className="story-progress">
                      <span>
                        Пролог · шаг {story.prologue.step + 1} из{" "}
                        {story.prologue.total_steps}
                      </span>
                      <div>
                        <i
                          style={{
                            width: `${
                              (story.prologue.step
                                / story.prologue.total_steps)
                              * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {story.prologue.last_response && (
                      <p className="story-response">
                        {story.prologue.last_response}
                      </p>
                    )}

                    <span className="story-eyebrow">
                      {story.prologue.next_choice.eyebrow}
                    </span>
                    <blockquote>{story.prologue.next_choice.quote}</blockquote>
                    <h2>{story.prologue.next_choice.prompt}</h2>

                    <div className="story-options">
                      {story.prologue.next_choice.options.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          disabled={isSubmitting}
                          className={
                            selectedCustomOption?.id === option.id
                              ? "is-selected"
                              : ""
                          }
                          onClick={() => void submitChoice(option)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </button>
                      ))}
                    </div>

                    {selectedCustomOption && (
                      <form
                        className="story-name-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitChoice(
                            selectedCustomOption,
                            customName,
                          );
                        }}
                      >
                        <label htmlFor="story-custom-name">
                          Предложить имя
                        </label>
                        <div>
                          <input
                            id="story-custom-name"
                            value={customName}
                            minLength={2}
                            maxLength={32}
                            autoFocus
                            placeholder="От 2 до 32 символов"
                            onChange={(event) =>
                              setCustomName(event.target.value)
                            }
                          />
                          <button
                            type="submit"
                            disabled={isSubmitting || customName.trim().length < 2}
                          >
                            Сохранить
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <div className="story-complete">
                    <span className="story-eyebrow">Пролог завершён</span>
                    <h2>Связь установлена</h2>
                    <p>
                      {story.prologue.last_response
                        || "Первый фрагмент занял своё место в Хронике."}
                    </p>
                    <blockquote>
                      Один факт у нас уже есть: я пришла сюда не целиком.
                      Второй — кто-то рассчитывал, что я всё-таки дойду.
                    </blockquote>
                    <span className="story-coming-soon">
                      Следующая глава появится в обновлении первого сезона
                    </span>
                  </div>
                )}

                <div className="story-relationship">
                  <h3>Состояние связи</h3>
                  {(
                    [
                      ["Доверие", story.relationship.trust],
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
                </div>
              </div>

              <aside className="story-map">
                <div className="story-map__head">
                  <span>MEMORY MAP</span>
                  <strong>Сезон 1</strong>
                </div>

                <div className="story-nodes">
                  {story.nodes.map((node, index) => (
                    <article
                      className={`story-node story-node--${node.status}`}
                      key={node.id}
                    >
                      <span className="story-node__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{node.title}</strong>
                        <span>{node.subtitle}</span>
                        {node.status !== "hidden" && (
                          <p>{node.description}</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <p className="story-consent-note">
                  Личные события попадают в «Хронику нас» только с разрешения
                  пользователя.
                </p>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
