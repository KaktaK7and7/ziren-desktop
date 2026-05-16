import { useEffect } from "react";

export default function ScreenOverlay() {
  useEffect(() => {
    document.documentElement.classList.add("screen-overlay-document");
    document.body.classList.add("screen-overlay-body");

    return () => {
      document.documentElement.classList.remove("screen-overlay-document");
      document.body.classList.remove("screen-overlay-body");
    };
  }, []);

  return (
    <div className="screen-overlay" aria-hidden="true">
      <div className="screen-overlay__edge" />
    </div>
  );
}
