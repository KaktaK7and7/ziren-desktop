import { getCurrentUser, clearSession } from "../services/session";
import "./ProfileModal.css";

type Props = {
  onClose: () => void;
  onLogout: () => void;
};

export default function ProfileModal({ onClose, onLogout }: Props) {
  const user = getCurrentUser();

  function handleLogout() {
    clearSession();
    onLogout();
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="profile-modal__header">
          <div>
            <p className="profile-modal__eyebrow">ZIREN PROFILE</p>
            <h2>{user?.username ?? "Unknown"}</h2>
          </div>

          <button className="profile-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="profile-modal__avatar">
          {(user?.username ?? "Z").slice(0, 1).toUpperCase()}
        </div>

        <div className="profile-modal__info">
          <div>
            <span>ID</span>
            <strong>{user?.id ?? "—"}</strong>
          </div>

          <div>
            <span>Email</span>
            <strong>{user?.email ?? "—"}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>Authorized</strong>
          </div>
        </div>

        <button className="profile-modal__logout" onClick={handleLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}