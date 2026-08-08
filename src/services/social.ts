import {
  fetchAuthenticatedAuthApi,
  getAuthSiteOrigin,
  readAuthApiJson,
  resolveAuthAssetUrl,
} from "./auth";

export type SocialFriend = {
  id: number;
  username: string;
  avatar_url: string;
  status_text: string;
  public_profile_url: string | null;
  voice_alias: string;
  announce_messages: boolean;
  unread_count: number;
  last_message_at: string | null;
};

export type FriendRequest = {
  id: number;
  direction: "incoming" | "outgoing";
  created_at: string;
  user: {
    id: number;
    username: string;
    avatar_url: string;
    public_profile_url: string | null;
  };
};

export type FriendSearchResult = {
  id: number;
  username: string;
  avatar_url: string;
  status_text: string;
  public_profile_url: string | null;
  friendship_status: "none" | "pending" | "accepted";
  request_direction: "incoming" | "outgoing" | null;
};

export type SocialMessage = {
  id: number;
  sender_id: number;
  recipient_id: number;
  kind: "text" | "clipboard" | "screenshot";
  body: string;
  created_at: string;
  read_at: string | null;
  attachment_url: string | null;
};

export type SocialGroup = {
  id: number;
  name: string;
  description: string;
  owner_user_id: number;
  role: "owner" | "admin" | "member";
  member_count: number;
  unread_count: number;
  last_message_at: string | null;
  last_message_body: string;
  created_at: string;
};

export type SocialGroupMember = {
  id: number;
  username: string;
  avatar_url: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  public_profile_url: string | null;
};

export type SocialGroupDetails = {
  id: number;
  name: string;
  description: string;
  owner_user_id: number;
  role: "owner" | "admin" | "member";
  created_at: string;
  members: SocialGroupMember[];
};

export type GroupMessage = {
  id: number;
  group_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar_url: string;
  body: string;
  created_at: string;
};

export type FriendsPayload = {
  ok: boolean;
  total: number;
  friends: SocialFriend[];
  requests: FriendRequest[];
  privacy: {
    show_friends_on_profile: boolean;
  };
  error?: string;
};

type SearchPayload = {
  ok: boolean;
  users: FriendSearchResult[];
  error?: string;
};

type ConversationPayload = {
  ok: boolean;
  messages: SocialMessage[];
  next_before_id: number | null;
  error?: string;
};

type MessagePayload = {
  ok: boolean;
  message?: SocialMessage;
  error?: string;
};

type GroupsPayload = {
  ok: boolean;
  groups: SocialGroup[];
  error?: string;
};

type GroupPayload = {
  ok: boolean;
  group: SocialGroupDetails;
  error?: string;
};

type GroupCreatePayload = {
  ok: boolean;
  group: SocialGroup;
  error?: string;
};

type GroupMessagesPayload = {
  ok: boolean;
  messages: GroupMessage[];
  next_before_id: number | null;
  error?: string;
};

type GroupMessagePayload = {
  ok: boolean;
  message?: GroupMessage;
  error?: string;
};

type SimplePayload = {
  ok: boolean;
  error?: string;
};

async function requireOk<T extends { ok: boolean; error?: string }>(
  response: Response,
  fallback: string,
) {
  const data = await readAuthApiJson<T>(response, fallback);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || fallback);
  }
  return data;
}

export async function fetchFriends() {
  const response = await fetchAuthenticatedAuthApi("/api/social/friends");
  return requireOk<FriendsPayload>(response, "Не удалось загрузить друзей");
}

export async function searchUsers(query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/users/search?q=${encodeURIComponent(normalized)}`,
  );
  const data = await requireOk<SearchPayload>(response, "Не удалось найти пользователей");
  return data.users;
}

export async function sendFriendRequest(userId: number) {
  const response = await fetchAuthenticatedAuthApi("/api/social/friends/requests", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return requireOk<SimplePayload>(response, "Не удалось отправить заявку");
}

export async function acceptFriendRequest(requestId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/friends/requests/${requestId}/accept`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return requireOk<SimplePayload>(response, "Не удалось принять заявку");
}

export async function deleteFriendRequest(requestId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/friends/requests/${requestId}`,
    { method: "DELETE" },
  );
  return requireOk<SimplePayload>(response, "Не удалось удалить заявку");
}

export async function removeFriend(friendId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/friends/${friendId}`,
    { method: "DELETE" },
  );
  return requireOk<SimplePayload>(response, "Не удалось удалить друга");
}

export async function updateFriendPreferences(
  friendId: number,
  preferences: { voice_alias: string; announce_messages: boolean },
) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/friends/${friendId}/preferences`,
    { method: "PATCH", body: JSON.stringify(preferences) },
  );
  return requireOk<SimplePayload>(response, "Не удалось сохранить настройки друга");
}

export async function updateFriendsPrivacy(showFriends: boolean) {
  const response = await fetchAuthenticatedAuthApi("/api/social/privacy", {
    method: "PATCH",
    body: JSON.stringify({ show_friends_on_profile: showFriends }),
  });
  return requireOk<SimplePayload>(response, "Не удалось сохранить видимость друзей");
}

export async function fetchConversation(friendId: number, beforeId?: number | null) {
  const query = beforeId ? `?before_id=${beforeId}` : "";
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/conversations/${friendId}${query}`,
  );
  return requireOk<ConversationPayload>(response, "Не удалось загрузить переписку");
}

export async function sendDirectMessage(friendId: number, body: string) {
  const response = await fetchAuthenticatedAuthApi("/api/social/messages", {
    method: "POST",
    body: JSON.stringify({ recipient_id: friendId, kind: "text", body }),
  });
  const data = await requireOk<MessagePayload>(response, "Не удалось отправить сообщение");
  if (!data.message) throw new Error("Сервер не вернул отправленное сообщение");
  return data.message;
}

export async function markConversationRead(friendId: number, upToId?: number | null) {
  const response = await fetchAuthenticatedAuthApi("/api/social/messages/read", {
    method: "POST",
    body: JSON.stringify({ friend_id: friendId, ...(upToId ? { up_to_id: upToId } : {}) }),
  });
  return requireOk<SimplePayload>(response, "Не удалось отметить сообщения прочитанными");
}

export async function fetchMessageAttachment(messageId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/messages/${messageId}/attachment`,
  );
  if (!response.ok) throw new Error("Не удалось загрузить скриншот");
  return response.blob();
}

export async function fetchGroups() {
  const response = await fetchAuthenticatedAuthApi("/api/social/groups");
  const data = await requireOk<GroupsPayload>(response, "Не удалось загрузить группы");
  return data.groups;
}

export async function createGroup(params: {
  name: string;
  description?: string;
  member_ids: number[];
}) {
  const response = await fetchAuthenticatedAuthApi("/api/social/groups", {
    method: "POST",
    body: JSON.stringify(params),
  });
  const data = await requireOk<GroupCreatePayload>(response, "Не удалось создать группу");
  return data.group;
}

export async function fetchGroup(groupId: number) {
  const response = await fetchAuthenticatedAuthApi(`/api/social/groups/${groupId}`);
  const data = await requireOk<GroupPayload>(response, "Не удалось загрузить группу");
  return data.group;
}

export async function updateGroup(
  groupId: number,
  params: { name: string; description: string },
) {
  const response = await fetchAuthenticatedAuthApi(`/api/social/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
  return requireOk<SimplePayload>(response, "Не удалось изменить группу");
}

export async function deleteGroup(groupId: number) {
  const response = await fetchAuthenticatedAuthApi(`/api/social/groups/${groupId}`, {
    method: "DELETE",
  });
  return requireOk<SimplePayload>(response, "Не удалось удалить группу");
}

export async function addGroupMember(groupId: number, userId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/groups/${groupId}/members`,
    { method: "POST", body: JSON.stringify({ user_id: userId }) },
  );
  return requireOk<SimplePayload>(response, "Не удалось добавить участника");
}

export async function updateGroupMemberRole(
  groupId: number,
  userId: number,
  role: "admin" | "member",
) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/groups/${groupId}/members/${userId}`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  );
  return requireOk<SimplePayload>(response, "Не удалось изменить роль участника");
}

export async function removeGroupMember(groupId: number, userId: number) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/groups/${groupId}/members/${userId}`,
    { method: "DELETE" },
  );
  return requireOk<SimplePayload>(response, "Не удалось удалить участника");
}

export async function fetchGroupMessages(groupId: number, beforeId?: number | null) {
  const query = beforeId ? `?before_id=${beforeId}` : "";
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/groups/${groupId}/messages${query}`,
  );
  return requireOk<GroupMessagesPayload>(response, "Не удалось загрузить сообщения группы");
}

export async function sendGroupMessage(groupId: number, body: string) {
  const response = await fetchAuthenticatedAuthApi(
    `/api/social/groups/${groupId}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  const data = await requireOk<GroupMessagePayload>(response, "Не удалось отправить сообщение в группу");
  if (!data.message) throw new Error("Сервер не вернул отправленное сообщение");
  return data.message;
}

export async function markGroupRead(groupId: number, upToId?: number | null) {
  const response = await fetchAuthenticatedAuthApi(`/api/social/groups/${groupId}/read`, {
    method: "POST",
    body: JSON.stringify(upToId ? { up_to_id: upToId } : {}),
  });
  return requireOk<SimplePayload>(response, "Не удалось отметить группу прочитанной");
}

export function socialAvatarUrl(value: string) {
  return resolveAuthAssetUrl(value);
}

export function socialProfileUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${getAuthSiteOrigin()}${value}`;
}
