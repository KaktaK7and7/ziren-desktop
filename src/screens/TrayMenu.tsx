import { invoke } from "@tauri-apps/api/core";
import "./TrayMenu.css";

export default function TrayMenu() {
  return (
    <div className="tray-menu-page">
      <div className="tray-menu">
        <div className="tray-menu__header">
          <span className="tray-menu__dot" />
          <span>ZIREN CONTROL</span>
        </div>

        <button onClick={() => invoke("tray_open")}>Открыть GUI</button>
        <button onClick={() => invoke("tray_hide")}>Скрыть GUI</button>

        <button className="danger" onClick={() => invoke("tray_exit")}>
          Выход
        </button>
      </div>
    </div>
  );
}