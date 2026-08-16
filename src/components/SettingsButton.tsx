import { useState } from "react";

import ControlSettingsModal from "./ControlSettingsModal";
import "./SettingsButtonMenu.css";


type Props = {
  onClick: () => void;
};


export default function SettingsButton({ onClick }: Props) {
  const [isControlOpen, setIsControlOpen] = useState(false);

  return (
    <>
      <div className="settings-button-host">
        <button className="settings-button" onClick={onClick} title="Настройки">
          ⚙
        </button>
        <div className="settings-button-menu" role="menu" aria-label="Быстрые разделы настроек">
          <button type="button" role="menuitem" onClick={onClick}>
            <strong>Настройки</strong>
            <span>Приложения, триггеры, музыка, Мелисса</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setIsControlOpen(true)}
          >
            <strong>Функции и режимы</strong>
            <span>Мелисса / Змея · полный список возможностей</span>
          </button>
        </div>
      </div>

      {isControlOpen && (
        <ControlSettingsModal
          onClose={() => setIsControlOpen(false)}
          onOpenClassicSettings={onClick}
        />
      )}
    </>
  );
}
