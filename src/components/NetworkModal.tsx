import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  acceptFriendRequest,
  addGroupMember,
  createGroup,
  deleteFriendRequest,
  deleteGroup,
  fetchConversation,
  fetchFriends,
  fetchGroup,
  fetchGroupMessages,
  fetchGroups,
  fetchMessageAttachment,
  markConversationRead,
  markGroupRead,
  removeFriend,
  removeGroupMember,
  searchUsers,
  sendDirectMessage,
  sendFriendRequest,
  sendGroupMessage,
  socialAvatarUrl,
  socialProfileUrl,
  updateFriendPreferences,
  updateFriendsPrivacy,
  updateGroup,
  updateGroupMemberRole,
  type FriendRequest,
  type FriendSearchResult,
  type GroupMessage,
  type SocialFriend,
  type SocialGroup,
  type SocialGroupDetails,
  type SocialMessage,
} from "../services/social";
import { getCurrentUser } from "../services/session";

import "./NetworkModal.css";

export type NetworkTab = "friends" | "messages";

type Props = {
  initialTab: NetworkTab;
  onClose: () => void;
};

type ActiveThread =
  | { type: "direct"; id: number }
  | { type: "group"; id: number }
  | null;

function formatTime(value: string | null | undefined) {
  if (!value) return "";
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

  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    void fetchMessageAttachment(messageId)
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (!url) return <div className="network-muted">Загрузка скриншота…</div>;

  return (
    <button
      type="button"
      style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
      onClick={() => void openUrl(url)}
    >
      <img src={url} alt="Скриншот" />
    </button>
  );
}

export default function NetworkModal({ initialTab, onClose }: Props) {
  const user = getCurrentUser();
  const currentUserId = Number(user?.id || 0);

  const [tab, setTab] = useState<NetworkTab>(initialTab);
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [showFriendsOnProfile, setShowFriendsOnProfile] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<Record<number, string>>({});
  const [active, setActive] = useState<ActiveThread>(null);
  const [directMessages, setDirectMessages] = useState<SocialMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupDetails, setGroupDetails] = useState<SocialGroupDetails | null>(null);
  const [messageText, setMessageText] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<Set<number>>(new Set());
  const [manageGroup, setManageGroup] = useState(false);
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
  const totalUnread = useMemo(
    () => friends.reduce((sum, friend) => sum + Number(friend.unread_count || 0), 0)
      + groups.reduce((sum, group) => sum + Number(group.unread_count || 0), 0),
    [friends, groups],
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
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Не удалось загрузить друзей");
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function refreshGroups(silent = false) {
    try {
      if (!silent) setBusy(true);
      setGroups(await fetchGroups());
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Не удалось загрузить группы");
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function refreshAll(silent = false) {
    await Promise.all([refreshFriends(silent), refreshGroups(silent)]);
  }

  async function handleSearch() {
    try {
      setBusy(true);
      setError("");
      setSearchResults(await searchUsers(searchText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось найти пользователей");
    } finally {
      setBusy(false);
    }
  }

  async function openProfile(url: string | null) {
    const resolved = socialProfileUrl(url);
    if (!resolved) return;
    try {
      await openUrl(resolved);
    } catch {
      setError("Не удалось открыть профиль в браузере");
    }
  }

  async function openDirect(friendId: number, silent = false) {
    const friend = friends.find((item) => item.id === friendId);
    if (!friend) return;
    try {
      if (!silent) setBusy(true);
      setActive({ type: "direct", id: friendId });
      setManageGroup(false);
      const data = await fetchConversation(friendId);
      setDirectMessages(data.messages);
      const lastIncoming = [...data.messages]
        .reverse()
        .find((message) => message.sender_id === friendId);
      if (lastIncoming) await markConversationRead(friendId, lastIncoming.id);
      await refreshFriends(true);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Не удалось открыть чат");
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function openGroup(groupId: number, silent = false) {
    try {
      if (!silent) setBusy(true);
      setActive({ type: "group", id: groupId });
      const [details, data] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMessages(groupId),
      ]);
      setGroupDetails(details);
      setGroupMessages(data.messages);
      const last = data.messages[data.messages.length - 1];
      await markGroupRead(groupId, last?.id);
      await refreshGroups(true);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Не удалось открыть группу");
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function sendCurrentMessage() {
    const body = messageText.trim();
    if (!active || !body || busy) return;
    try {
      setBusy(true);
      setError("");
      if (active.type === "direct") {
        const sent = await sendDirectMessage(active.id, body);
        setDirectMessages((items) => [...items, sent]);
        await refreshFriends(true);
      } else {
        const sent = await sendGroupMessage(active.id, body);
        setGroupMessages((items) => [...items, sent]);
        await refreshGroups(true);
      }
      setMessageText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    } finally {
      setBusy(false);
    }
  }

  async function createNewGroup() {
    if (groupName.trim().length < 2) return;
    try {
      setBusy(true);
      setError("");
      const group = await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
        member_ids: [...newGroupMembers],
      });
      setGroupName("");
      setGroupDescription("");
      setNewGroupMembers(new Set());
      setCreateGroupOpen(false);
      await refreshGroups(true);
      await openGroup(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать группу");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    const id = window.setInterval(() => void refreshAll(true), 7000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active || tab !== "messages") return;
    const id = window.setInterval(() => {
      if (active.type === "direct") void openDirect(active.id, true);
      else void openGroup(active.id, true);
    }, 3500);
    return () => window.clearInterval(id);
  }, [active?.type, active?.id, tab]);

  function renderFriendRow(friend: SocialFriend) {
    return (
      <div className="network-person-row" key={friend.id}>
        <img src={socialAvatarUrl(friend.avatar_url)} alt="" />
        <div className="network-person-copy">
          <strong>{friend.username}</strong>
          <small>{friend.status_text || (friend.voice_alias ? `Голосовое имя: ${friend.voice_alias}` : "Друг Ziren")}</small>
          <div className="network-friend-prefs">
            <input
              className="network-input"
              maxLength={48}
              value={aliasDrafts[friend.id] ?? friend.voice_alias}
              placeholder="Голосовое имя"
              onChange={(event) => setAliasDrafts((current) => ({ ...current, [friend.id]: event.target.value }))}
            />
            <label className="network-check">
              <input
                type="checkbox"
                checked={friend.announce_messages}
                onChange={async (event) => {
                  try {
                    await updateFriendPreferences(friend.id, {
                      voice_alias: aliasDrafts[friend.id] ?? friend.voice_alias,
                      announce_messages: event.target.checked,
                    });
                    await refreshFriends(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось изменить озвучивание");
                  }
                }}
              />
              Озвучивать
            </label>
            <button
              className="network-btn"
              type="button"
              onClick={async () => {
                try {
                  await updateFriendPreferences(friend.id, {
                    voice_alias: aliasDrafts[friend.id] ?? friend.voice_alias,
                    announce_messages: friend.announce_messages,
                  });
                  await refreshFriends(true);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Не удалось сохранить alias");
                }
              }}
            >
              Сохранить
            </button>
          </div>
        </div>
        <div className="network-actions">
          {friend.public_profile_url && (
            <button className="network-btn is-ghost" type="button" onClick={() => void openProfile(friend.public_profile_url)}>
              Профиль
            </button>
          )}
          <button className="network-btn" type="button" onClick={() => { setTab("messages"); void openDirect(friend.id); }}>
            Написать
          </button>
          <button
            className="network-btn is-danger"
            type="button"
            onClick={async () => {
              if (!window.confirm(`Удалить ${friend.username} из друзей?`)) return;
              try {
                await removeFriend(friend.id);
                await refreshFriends();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Не удалось удалить друга");
              }
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    );
  }

  function renderRequest(request: FriendRequest) {
    return (
      <div className="network-person-row" key={request.id}>
        <img src={socialAvatarUrl(request.user.avatar_url)} alt="" />
        <div className="network-person-copy">
          <strong>{request.user.username}</strong>
          <small>{request.direction === "incoming" ? "Хочет добавить тебя в друзья" : "Ожидает ответа"}</small>
        </div>
        <div className="network-actions">
          {request.user.public_profile_url && (
            <button className="network-btn is-ghost" type="button" onClick={() => void openProfile(request.user.public_profile_url)}>
              Профиль
            </button>
          )}
          {request.direction === "incoming" && (
            <button
              className="network-btn"
              type="button"
              onClick={async () => {
                try {
                  await acceptFriendRequest(request.id);
                  await refreshFriends();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Не удалось принять заявку");
                }
              }}
            >
              Принять
            </button>
          )}
          <button
            className="network-btn is-ghost"
            type="button"
            onClick={async () => {
              try {
                await deleteFriendRequest(request.id);
                await refreshFriends();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Не удалось удалить заявку");
              }
            }}
          >
            {request.direction === "incoming" ? "Отклонить" : "Отменить"}
          </button>
        </div>
      </div>
    );
  }

  function renderFriendsView() {
    return (
      <div className="network-friends-view">
        <section className="network-card">
          <div className="network-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h3>Найти пользователя</h3>
            <label className="network-check">
              <input
                type="checkbox"
                checked={showFriendsOnProfile}
                onChange={async (event) => {
                  try {
                    await updateFriendsPrivacy(event.target.checked);
                    setShowFriendsOnProfile(event.target.checked);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось сохранить приватность");
                  }
                }}
              />
              Показывать друзей в профиле
            </label>
          </div>
          <div className="network-search-row">
            <input
              className="network-input"
              maxLength={64}
              value={searchText}
              placeholder="Ник пользователя"
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void handleSearch(); }}
            />
            <button className="network-btn" type="button" disabled={busy || searchText.trim().length < 2} onClick={() => void handleSearch()}>
              Найти
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="network-list" style={{ marginTop: 10 }}>
              {searchResults.map((person) => (
                <div className="network-person-row" key={person.id}>
                  <img src={socialAvatarUrl(person.avatar_url)} alt="" />
                  <div className="network-person-copy">
                    <strong>{person.username}</strong>
                    <small>{person.status_text || "Пользователь Ziren"}</small>
                  </div>
                  <div className="network-actions">
                    {person.public_profile_url && (
                      <button className="network-btn is-ghost" type="button" onClick={() => void openProfile(person.public_profile_url)}>
                        Профиль
                      </button>
                    )}
                    {person.friendship_status === "none" ? (
                      <button
                        className="network-btn"
                        type="button"
                        onClick={async () => {
                          try {
                            await sendFriendRequest(person.id);
                            await refreshFriends(true);
                            await handleSearch();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
                          }
                        }}
                      >
                        + В друзья
                      </button>
                    ) : person.friendship_status === "accepted" ? (
                      <button className="network-btn" type="button" onClick={() => { setTab("messages"); void openDirect(person.id); }}>
                        Написать
                      </button>
                    ) : (
                      <span className="network-muted">{person.request_direction === "incoming" ? "Заявка тебе" : "Заявка отправлена"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
          <section className="network-card">
            <h3>Заявки</h3>
            <div className="network-list">
              {incomingRequests.map(renderRequest)}
              {outgoingRequests.map(renderRequest)}
            </div>
          </section>
        )}

        <section className="network-card">
          <h3>Друзья · {friends.length}</h3>
          <div className="network-list">
            {friends.length ? friends.map(renderFriendRow) : <p className="network-muted">Друзей пока нет.</p>}
          </div>
        </section>
      </div>
    );
  }

  function renderThreadSidebar() {
    return (
      <aside className="network-thread-sidebar">
        <div className="network-create-group">
          <button className="network-btn" type="button" onClick={() => setCreateGroupOpen((current) => !current)}>
            + Создать группу
          </button>
          {createGroupOpen && (
            <>
              <input className="network-input" maxLength={80} value={groupName} placeholder="Название группы" onChange={(event) => setGroupName(event.target.value)} />
              <textarea className="network-textarea" maxLength={280} value={groupDescription} placeholder="Описание" onChange={(event) => setGroupDescription(event.target.value)} />
              <div className="network-member-picker">
                {friends.map((friend) => (
                  <label key={friend.id}>
                    <input
                      type="checkbox"
                      checked={newGroupMembers.has(friend.id)}
                      onChange={(event) => setNewGroupMembers((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(friend.id);
                        else next.delete(friend.id);
                        return next;
                      })}
                    />
                    {friend.voice_alias || friend.username}
                  </label>
                ))}
              </div>
              <button className="network-btn" type="button" disabled={busy || groupName.trim().length < 2} onClick={() => void createNewGroup()}>
                Создать
              </button>
            </>
          )}
        </div>

        <div className="network-thread-title">ЛИЧНЫЕ ЧАТЫ</div>
        {friends.map((friend) => (
          <button
            className={`network-thread${active?.type === "direct" && active.id === friend.id ? " is-active" : ""}`}
            type="button"
            key={`friend-${friend.id}`}
            onClick={() => void openDirect(friend.id)}
          >
            <img src={socialAvatarUrl(friend.avatar_url)} alt="" />
            <div className="network-thread-copy">
              <strong>{friend.voice_alias || friend.username}</strong>
              <small>{friend.last_message_at ? formatTime(friend.last_message_at) : friend.status_text || "Начать диалог"}</small>
            </div>
            {friend.unread_count > 0 && <span className="network-unread">{Math.min(friend.unread_count, 99)}</span>}
          </button>
        ))}

        <div className="network-thread-title">ГРУППЫ</div>
        {groups.map((group) => (
          <button
            className={`network-thread${active?.type === "group" && active.id === group.id ? " is-active" : ""}`}
            type="button"
            key={`group-${group.id}`}
            onClick={() => void openGroup(group.id)}
          >
            <div style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 10, border: "1px solid rgba(0,245,255,.14)", color: "#00f5ff" }}>#</div>
            <div className="network-thread-copy">
              <strong>{group.name}</strong>
              <small>{group.last_message_body || `${group.member_count} участников`}</small>
            </div>
            {group.unread_count > 0 && <span className="network-unread">{Math.min(group.unread_count, 99)}</span>}
          </button>
        ))}
      </aside>
    );
  }

  function renderDirectChat(friend: SocialFriend) {
    return (
      <section className="network-chat-pane">
        <div className="network-chat-head">
          <div>
            <h3>{friend.voice_alias || friend.username}</h3>
            <span className="network-muted">{friend.username}</span>
          </div>
          <div className="network-actions">
            {friend.public_profile_url && (
              <button className="network-btn is-ghost" type="button" onClick={() => void openProfile(friend.public_profile_url)}>
                Профиль
              </button>
            )}
          </div>
        </div>
        <div className="network-messages">
          {directMessages.length ? directMessages.map((message) => (
            <article className={`network-message${message.sender_id === currentUserId ? " is-own" : ""}`} key={message.id}>
              {message.body && <div className="network-message-body">{message.body}</div>}
              {message.kind === "screenshot" && <MessageScreenshot messageId={message.id} />}
              <div className="network-message-time">{formatTime(message.created_at)}</div>
            </article>
          )) : <div className="network-empty">Сообщений пока нет.</div>}
        </div>
        <div className="network-compose">
          <input className="network-input" maxLength={4000} value={messageText} placeholder="Сообщение…" onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendCurrentMessage(); } }} />
          <button className="network-btn" type="button" disabled={busy || !messageText.trim()} onClick={() => void sendCurrentMessage()}>
            Отправить
          </button>
        </div>
      </section>
    );
  }

  function renderGroupManager(details: SocialGroupDetails) {
    const canManage = details.role === "owner" || details.role === "admin";
    const existingIds = new Set(details.members.map((member) => member.id));
    const availableFriends = friends.filter((friend) => !existingIds.has(friend.id));
    return (
      <section className="network-chat-pane">
        <div className="network-chat-head">
          <div>
            <h3>{details.name}</h3>
            <span className="network-muted">Управление группой</span>
          </div>
          <button className="network-btn is-ghost" type="button" onClick={() => setManageGroup(false)}>← В чат</button>
        </div>
        <div className="network-messages">
          {canManage && (
            <div className="network-card">
              <h3>Название и описание</h3>
              <input id="network-group-name-edit" className="network-input" defaultValue={details.name} maxLength={80} />
              <textarea id="network-group-description-edit" className="network-textarea" defaultValue={details.description} maxLength={280} style={{ marginTop: 7 }} />
              <button
                className="network-btn"
                type="button"
                style={{ marginTop: 7 }}
                onClick={async () => {
                  const nameInput = document.getElementById("network-group-name-edit") as HTMLInputElement | null;
                  const descriptionInput = document.getElementById("network-group-description-edit") as HTMLTextAreaElement | null;
                  try {
                    await updateGroup(details.id, {
                      name: nameInput?.value || details.name,
                      description: descriptionInput?.value || "",
                    });
                    await openGroup(details.id);
                    setManageGroup(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Не удалось изменить группу");
                  }
                }}
              >
                Сохранить
              </button>
            </div>
          )}

          <div className="network-card">
            <h3>Участники · {details.members.length}</h3>
            <div className="network-list">
              {details.members.map((member) => (
                <div className="network-member-row" key={member.id}>
                  <img src={socialAvatarUrl(member.avatar_url)} alt="" />
                  <div className="network-member-copy">
                    <strong>{member.username}</strong>
                    <small>{member.role === "owner" ? "Владелец" : member.role === "admin" ? "Администратор" : "Участник"}</small>
                  </div>
                  <div className="network-actions">
                    {member.public_profile_url && (
                      <button className="network-btn is-ghost" type="button" onClick={() => void openProfile(member.public_profile_url)}>Профиль</button>
                    )}
                    {details.role === "owner" && member.role !== "owner" && (
                      <button
                        className="network-btn is-ghost"
                        type="button"
                        onClick={async () => {
                          try {
                            await updateGroupMemberRole(details.id, member.id, member.role === "admin" ? "member" : "admin");
                            await openGroup(details.id);
                            setManageGroup(true);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Не удалось изменить роль");
                          }
                        }}
                      >
                        {member.role === "admin" ? "Снять админа" : "Сделать админом"}
                      </button>
                    )}
                    {member.id === currentUserId && member.role !== "owner" && (
                      <button className="network-btn is-danger" type="button" onClick={async () => {
                        try {
                          await removeGroupMember(details.id, member.id);
                          setActive(null);
                          setGroupDetails(null);
                          await refreshGroups();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Не удалось покинуть группу");
                        }
                      }}>Покинуть</button>
                    )}
                    {member.id !== currentUserId && canManage && member.role === "member" && (
                      <button className="network-btn is-danger" type="button" onClick={async () => {
                        try {
                          await removeGroupMember(details.id, member.id);
                          await openGroup(details.id);
                          setManageGroup(true);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Не удалось удалить участника");
                        }
                      }}>Удалить</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canManage && availableFriends.length > 0 && (
            <div className="network-card">
              <h3>Добавить друга</h3>
              <div className="network-list">
                {availableFriends.map((friend) => (
                  <div className="network-person-row" key={friend.id}>
                    <img src={socialAvatarUrl(friend.avatar_url)} alt="" />
                    <div className="network-person-copy"><strong>{friend.username}</strong></div>
                    <button className="network-btn" type="button" onClick={async () => {
                      try {
                        await addGroupMember(details.id, friend.id);
                        await openGroup(details.id);
                        setManageGroup(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Не удалось добавить участника");
                      }
                    }}>Добавить</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {details.role === "owner" && (
            <button className="network-btn is-danger" type="button" onClick={async () => {
              if (!window.confirm(`Удалить группу «${details.name}» и всю историю?`)) return;
              try {
                await deleteGroup(details.id);
                setActive(null);
                setGroupDetails(null);
                await refreshGroups();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Не удалось удалить группу");
              }
            }}>Удалить группу</button>
          )}
        </div>
        <div />
      </section>
    );
  }

  function renderGroupChat(details: SocialGroupDetails) {
    if (manageGroup) return renderGroupManager(details);
    return (
      <section className="network-chat-pane">
        <div className="network-chat-head">
          <div>
            <h3>{details.name}</h3>
            <span className="network-muted">{details.members.length} участников · {details.role}</span>
          </div>
          <button className="network-btn is-ghost" type="button" onClick={() => setManageGroup(true)}>Участники</button>
        </div>
        <div className="network-messages">
          {groupMessages.length ? groupMessages.map((message) => (
            <article className={`network-message${message.sender_id === currentUserId ? " is-own" : ""}`} key={message.id}>
              {message.sender_id !== currentUserId && <div className="network-message-author">{message.sender_username}</div>}
              <div className="network-message-body">{message.body}</div>
              <div className="network-message-time">{formatTime(message.created_at)}</div>
            </article>
          )) : <div className="network-empty">Это начало группы.</div>}
        </div>
        <div className="network-compose">
          <input className="network-input" maxLength={4000} value={messageText} placeholder={`Сообщение в «${details.name}»…`} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendCurrentMessage(); } }} />
          <button className="network-btn" type="button" disabled={busy || !messageText.trim()} onClick={() => void sendCurrentMessage()}>Отправить</button>
        </div>
      </section>
    );
  }

  function renderMessagesView() {
    const directFriend = active?.type === "direct"
      ? friends.find((friend) => friend.id === active.id) || null
      : null;
    return (
      <div className="network-messenger">
        {renderThreadSidebar()}
        {active?.type === "direct" && directFriend
          ? renderDirectChat(directFriend)
          : active?.type === "group" && groupDetails
            ? renderGroupChat(groupDetails)
            : <section className="network-chat-pane"><div className="network-empty">Выбери личный диалог или группу.</div><div /><div /></section>}
      </div>
    );
  }

  return (
    <div className="network-modal-overlay">
      <div className="network-modal-page">
        <header className="network-modal-head">
          <div>
            <span>ZIREN NETWORK</span>
            <h2>{tab === "friends" ? "Друзья" : "Сообщения"}</h2>
            <p>Синхронизировано с сайтом Ziren</p>
          </div>
          <div className="network-head-actions">
            {totalUnread > 0 && <span className="network-unread">{Math.min(totalUnread, 99)}</span>}
            <button className="network-btn is-ghost" type="button" onClick={onClose}>Закрыть</button>
          </div>
        </header>

        <div className="network-tabs">
          <button className={tab === "friends" ? "is-active" : ""} type="button" onClick={() => setTab("friends")}>Друзья · {friends.length}</button>
          <button className={tab === "messages" ? "is-active" : ""} type="button" onClick={() => setTab("messages")}>Сообщения · {totalUnread}</button>
        </div>

        {error && <div className="network-error">{error}</div>}
        {tab === "friends" ? renderFriendsView() : renderMessagesView()}
      </div>
    </div>
  );
}
