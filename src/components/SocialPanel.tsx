import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  acceptFriendRequest,
  deleteFriendRequest,
  fetchConversation,
  fetchFriends,
  fetchMessageAttachment,
  markConversationRead,
  removeFriend,
  searchUsers,
  sendDirectMessage,
  sendFriendRequest,
  socialAvatarUrl,
  socialProfileUrl,
  updateFriendPreferences,
  updateFriendsPrivacy,
  type FriendRequest,
  type FriendSearchResult,
  type SocialFriend,
  type SocialMessage,
} from "../services/social";

import "./SocialPanel.css";


type Props = {
  currentUserId: number | null;
};


type View = "friends" | "chat" | "profile";


function formatMessageTime(value: string) {
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}


function MessageScreenshot({ messageId }: { messageId: number }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let objectUrl = "";

    void fetchMessageAttachment(messageId)
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (failed) {
    return <div className="social-shot-error">Скриншот недоступен</div>;
  }

  if (!url) {
    return <div className="social-shot-loading">Загрузка скриншота…</div>;
  }

  return (
    <button
      className="social-shot-button"
      type="button"
      onClick={() => void openUrl(url)}
      title="Открыть скриншот"
    >
      <img src={url} alt="Скриншот из сообщения" />
    </button>
  );
}


export default function SocialPanel({ currentUserId }: Props) {
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [showFriendsOnProfile, setShowFriendsOnProfile] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<SocialFriend | null>(null);
  const [view, setView] = useState<View>("friends");
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const incomingRequests = useMemo(
    () => requests.filter((request) => request.direction === "incoming"),
    [requests],
  );
  const outgoingRequests = useMemo(
    () => requests.filter((request) => request.direction === "outgoing"),
    [requests],
  );

  async function refreshFriends(silent = false) {
    try {
      if (!silent) setBusy(true);
      const data = await fetchFriends();
      setFriends(data.friends);
      setRequests(data.requests);
      setShowFriendsOnProfile(data.privacy.show_friends_on_profile);
      setAliasDrafts((current) => {
        const next = { ...current };
        for (const friend of data.friends) {
          if (!(friend.id in next)) next[friend.id] = friend.voice_alias;
        }
        return next;
      });

      if (selectedFriend) {
        const refreshed = data.friends.find(
          (friend) => friend.id === selectedFriend.id,
        );
        if (refreshed) setSelectedFriend(refreshed);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить друзей");
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function loadConversation(friend: SocialFriend, silent = false) {
    try {
      if (!silent) setBusy(true);
      const data = await fetchConversation(friend.id);
      setMessages(data.messages);
      const lastIncoming = [...data.messages]
        .reverse()
        .find((message) => message.sender_id === friend.id);
      if (lastIncoming) {
        await markConversationRead(friend.id, lastIncoming.id);
      }
      if (!silent) await refreshFriends(true);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Не удалось открыть чат");
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  function openChat(friend: SocialFriend) {
    setSelectedFriend(friend);
    setView("chat");
    setMessages([]);
    setError("");
    void loadConversation(friend);
  }

  function openFriendProfile(friend: SocialFriend) {
    setSelectedFriend(friend);
    setView("profile");
    setError("");
  }

  async function handleSearch() {
    try {
      setBusy(true);
      setError("");
      setSearchResults(await searchUsers(searchText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setBusy(false);
    }
  }

  async function handleFriendRequest(userId: number) {
    try {
      setBusy(true);
      setError("");
      await sendFriendRequest(userId);
      await Promise.all([refreshFriends(true), handleSearch()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
      setBusy(false);
    }
  }

  async function handleAccept(requestId: number) {
    try {
      setBusy(true);
      setError("");
      await acceptFriendRequest(requestId);
      await refreshFriends(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось принять заявку");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRequest(requestId: number) {
    try {
      setBusy(true);
      setError("");
      await deleteFriendRequest(requestId);
      await refreshFriends(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить заявку");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFriendPreferences(friend: SocialFriend) {
    try {
      setBusy(true);
      setError("");
      await updateFriendPreferences(friend.id, {
        voice_alias: aliasDrafts[friend.id] ?? friend.voice_alias,
        announce_messages: friend.announce_messages,
      });
      await refreshFriends(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить голосовое имя",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAnnounceChange(
    friend: SocialFriend,
    announceMessages: boolean,
  ) {
    try {
      setBusy(true);
      setError("");
      await updateFriendPreferences(friend.id, {
        voice_alias: aliasDrafts[friend.id] ?? friend.voice_alias,
        announce_messages: announceMessages,
      });
      setFriends((items) =>
        items.map((item) =>
          item.id === friend.id
            ? { ...item, announce_messages: announceMessages }
            : item,
        ),
      );
      if (selectedFriend?.id === friend.id) {
        setSelectedFriend({
          ...friend,
          announce_messages: announceMessages,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить озвучивание");
    } finally {
      setBusy(false);
    }
  }

  async function handlePrivacyChange(value: boolean) {
    try {
      setBusy(true);
      setError("");
      await updateFriendsPrivacy(value);
      setShowFriendsOnProfile(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить приватность");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveFriend(friend: SocialFriend) {
    if (!window.confirm(`Удалить ${friend.username} из друзей?`)) return;

    try {
      setBusy(true);
      setError("");
      await removeFriend(friend.id);
      setSelectedFriend(null);
      setView("friends");
      await refreshFriends(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить друга");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    const body = messageText.trim();
    if (!selectedFriend || !body || busy) return;

    try {
      setBusy(true);
      setError("");
      const sent = await sendDirectMessage(selectedFriend.id, body);
      setMessages((items) => [...items, sent]);
      setMessageText("");
      await refreshFriends(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshFriends();
    const intervalId = window.setInterval(() => void refreshFriends(true), 7000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (view !== "chat" || !selectedFriend) return;
    const friend = selectedFriend;
    const intervalId = window.setInterval(
      () => void loadConversation(friend, true),
      3500,
    );
    return () => window.clearInterval(intervalId);
  }, [view, selectedFriend?.id]);

  return (
    <section className="profile-panel profile-social-panel">
      <div className="profile-panel-head social-panel-head">
        <div>
          <span>ZIREN NETWORK</span>
          <h3>
            {view === "friends"
              ? `Друзья · ${friends.length}`
              : view === "chat"
                ? `Чат · ${selectedFriend?.voice_alias || selectedFriend?.username || ""}`
                : `Профиль · ${selectedFriend?.username || ""}`}
          </h3>
        </div>
        {view !== "friends" && (
          <button
            className="social-ghost-button"
            type="button"
            onClick={() => setView("friends")}
          >
            ← Друзья
          </button>
        )}
      </div>

      {error && <div className="social-error">{error}</div>}

      {view === "friends" && (
        <>
          <label className="social-privacy-row">
            <span>
              <strong>Показывать друзей в профиле</strong>
              <small>
                Если выключено, посетители не увидят ни список, ни количество друзей.
              </small>
            </span>
            <input
              type="checkbox"
              checked={showFriendsOnProfile}
              disabled={busy}
              onChange={(event) => void handlePrivacyChange(event.target.checked)}
            />
          </label>

          <div className="social-search-row">
            <input
              value={searchText}
              maxLength={64}
              placeholder="Найти пользователя по нику"
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSearch();
              }}
            />
            <button
              type="button"
              disabled={busy || searchText.trim().length < 2}
              onClick={() => void handleSearch()}
            >
              Найти
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="social-search-results">
              {searchResults.map((person) => (
                <div className="social-person-row" key={person.id}>
                  <img src={socialAvatarUrl(person.avatar_url)} alt="" />
                  <div>
                    <strong>{person.username}</strong>
                    <small>{person.status_text || "Пользователь Ziren"}</small>
                  </div>
                  {person.friendship_status === "none" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleFriendRequest(person.id)}
                    >
                      + В друзья
                    </button>
                  ) : (
                    <span className="social-state-badge">
                      {person.friendship_status === "accepted"
                        ? "УЖЕ ДРУГ"
                        : person.request_direction === "incoming"
                          ? "ЗАЯВКА ТЕБЕ"
                          : "ЗАЯВКА ОТПРАВЛЕНА"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {incomingRequests.length > 0 && (
            <div className="social-request-block">
              <strong>Входящие заявки · {incomingRequests.length}</strong>
              {incomingRequests.map((request) => (
                <div className="social-person-row" key={request.id}>
                  <img src={socialAvatarUrl(request.user.avatar_url)} alt="" />
                  <div>
                    <strong>{request.user.username}</strong>
                    <small>Хочет добавить тебя в друзья</small>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAccept(request.id)}
                  >
                    Принять
                  </button>
                  <button
                    className="social-ghost-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeleteRequest(request.id)}
                  >
                    Отклонить
                  </button>
                </div>
              ))}
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div className="social-request-block is-muted">
              <strong>Отправленные заявки · {outgoingRequests.length}</strong>
              {outgoingRequests.map((request) => (
                <div className="social-person-row" key={request.id}>
                  <img src={socialAvatarUrl(request.user.avatar_url)} alt="" />
                  <div>
                    <strong>{request.user.username}</strong>
                    <small>Ожидаем принятия</small>
                  </div>
                  <button
                    className="social-ghost-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeleteRequest(request.id)}
                  >
                    Отменить
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="social-friend-list">
            {friends.length === 0 ? (
              <p className="profile-muted-text">
                Друзей пока нет. Найди пользователя по нику и отправь заявку.
              </p>
            ) : (
              friends.map((friend) => (
                <article className="social-friend-card" key={friend.id}>
                  <div className="social-friend-main">
                    <button
                      className="social-avatar-button"
                      type="button"
                      onClick={() => openFriendProfile(friend)}
                    >
                      <img src={socialAvatarUrl(friend.avatar_url)} alt="" />
                    </button>
                    <div>
                      <button
                        className="social-name-button"
                        type="button"
                        onClick={() => openFriendProfile(friend)}
                      >
                        {friend.username}
                      </button>
                      <small>{friend.status_text || "Пользователь Ziren"}</small>
                    </div>
                    {friend.unread_count > 0 && (
                      <span className="social-unread">{friend.unread_count}</span>
                    )}
                  </div>

                  <div className="social-friend-settings">
                    <label>
                      <span>Имя для голоса</span>
                      <input
                        value={aliasDrafts[friend.id] ?? friend.voice_alias}
                        maxLength={48}
                        placeholder="Например: Диана"
                        onChange={(event) =>
                          setAliasDrafts((current) => ({
                            ...current,
                            [friend.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      className="social-ghost-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveFriendPreferences(friend)}
                    >
                      Сохранить имя
                    </button>
                    <label className="social-announce-toggle">
                      <span>
                        <strong>Озвучивать сообщения</strong>
                        <small>Мелисса прочитает новые входящие от этого человека.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={friend.announce_messages}
                        disabled={busy}
                        onChange={(event) =>
                          void handleAnnounceChange(friend, event.target.checked)
                        }
                      />
                    </label>
                  </div>

                  <div className="social-card-actions">
                    <button type="button" onClick={() => openChat(friend)}>
                      Сообщения
                    </button>
                    <button
                      className="social-ghost-button"
                      type="button"
                      onClick={() => openFriendProfile(friend)}
                    >
                      Профиль
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}

      {view === "profile" && selectedFriend && (
        <div className="social-friend-profile">
          <img src={socialAvatarUrl(selectedFriend.avatar_url)} alt="" />
          <div>
            <span className="profile-kicker">ZIREN FRIEND</span>
            <h4>{selectedFriend.username}</h4>
            <p>{selectedFriend.status_text || "Пользователь Ziren"}</p>
            {selectedFriend.voice_alias && (
              <p>
                Голосовое имя у тебя: <strong>{selectedFriend.voice_alias}</strong>
              </p>
            )}
          </div>
          <div className="social-profile-actions">
            <button type="button" onClick={() => openChat(selectedFriend)}>
              Написать
            </button>
            {selectedFriend.public_profile_url && (
              <button
                className="social-ghost-button"
                type="button"
                onClick={() => {
                  const url = socialProfileUrl(selectedFriend.public_profile_url);
                  if (url) void openUrl(url);
                }}
              >
                Открыть полный профиль
              </button>
            )}
            <button
              className="social-danger-button"
              type="button"
              disabled={busy}
              onClick={() => void handleRemoveFriend(selectedFriend)}
            >
              Удалить из друзей
            </button>
          </div>
        </div>
      )}

      {view === "chat" && selectedFriend && (
        <div className="social-chat">
          <div className="social-chat-header">
            <button
              className="social-avatar-button"
              type="button"
              onClick={() => openFriendProfile(selectedFriend)}
            >
              <img src={socialAvatarUrl(selectedFriend.avatar_url)} alt="" />
            </button>
            <div>
              <strong>{selectedFriend.voice_alias || selectedFriend.username}</strong>
              {selectedFriend.voice_alias && <small>{selectedFriend.username}</small>}
            </div>
            <label className="social-chat-announce">
              <span>Озвучивать</span>
              <input
                type="checkbox"
                checked={selectedFriend.announce_messages}
                disabled={busy}
                onChange={(event) =>
                  void handleAnnounceChange(selectedFriend, event.target.checked)
                }
              />
            </label>
          </div>

          <div className="social-message-list">
            {messages.length === 0 ? (
              <p className="profile-muted-text">Сообщений пока нет.</p>
            ) : (
              messages.map((message) => {
                const own = currentUserId !== null && message.sender_id === currentUserId;
                return (
                  <div
                    className={`social-message${own ? " is-own" : ""}`}
                    key={message.id}
                  >
                    {message.kind === "screenshot" && (
                      <MessageScreenshot messageId={message.id} />
                    )}
                    {message.body && <p>{message.body}</p>}
                    {message.kind === "clipboard" && (
                      <span className="social-message-kind">СКОПИРОВАННЫЙ ТЕКСТ</span>
                    )}
                    <small>{formatMessageTime(message.created_at)}</small>
                  </div>
                );
              })
            )}
          </div>

          <div className="social-compose">
            <textarea
              value={messageText}
              maxLength={4000}
              placeholder={`Сообщение для ${selectedFriend.voice_alias || selectedFriend.username}`}
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !messageText.trim()}
              onClick={() => void handleSendMessage()}
            >
              Отправить
            </button>
          </div>
          <p className="social-voice-hint">
            Голосом: «Мелисса, напиши {selectedFriend.voice_alias || selectedFriend.username} привет» ·
            «сделай скриншот и отправь {selectedFriend.voice_alias || selectedFriend.username}».
          </p>
        </div>
      )}
    </section>
  );
}
