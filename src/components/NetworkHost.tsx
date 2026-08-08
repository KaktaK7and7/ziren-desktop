import { useEffect, useMemo, useState } from "react";

import NetworkModal, { type NetworkTab } from "./NetworkModal";
import { fetchFriends, fetchGroups } from "../services/social";

export default function NetworkHost() {
  const [openTab, setOpenTab] = useState<NetworkTab | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshCounters() {
    try {
      const [friendsData, groups] = await Promise.all([
        fetchFriends(),
        fetchGroups(),
      ]);
      setFriendCount(friendsData.friends.length);
      setUnreadCount(
        friendsData.friends.reduce(
          (sum, friend) => sum + Number(friend.unread_count || 0),
          0,
        )
          + groups.reduce(
            (sum, group) => sum + Number(group.unread_count || 0),
            0,
          ),
      );
    } catch {
      // Основной интерфейс ассистента не должен зависеть от social API.
    }
  }

  useEffect(() => {
    void refreshCounters();
    const id = window.setInterval(() => void refreshCounters(), 7000);
    return () => window.clearInterval(id);
  }, []);

  const unreadLabel = useMemo(
    () => (unreadCount > 99 ? "99+" : String(unreadCount)),
    [unreadCount],
  );

  return (
    <>
      <div className="network-shortcuts">
        <button
          className="network-shortcut-button"
          type="button"
          title="Друзья Ziren"
          onClick={() => setOpenTab("friends")}
        >
          Друзья
          {friendCount > 0 && <b>{friendCount > 99 ? "99+" : friendCount}</b>}
        </button>
        <button
          className="network-shortcut-button"
          type="button"
          title="Сообщения Ziren"
          onClick={() => setOpenTab("messages")}
        >
          Сообщения
          {unreadCount > 0 && <b>{unreadLabel}</b>}
        </button>
      </div>

      {openTab && (
        <NetworkModal
          initialTab={openTab}
          onClose={() => {
            setOpenTab(null);
            void refreshCounters();
          }}
        />
      )}
    </>
  );
}
