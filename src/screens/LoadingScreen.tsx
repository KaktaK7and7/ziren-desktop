import LogoOrb from "../components/LogoOrb";

export default function LoadingScreen() {
  return (
    <div className="screen loading-screen">
      <LogoOrb />
      <h1>Ziren Assistant</h1>
      <p>Загружается...</p>
    </div>
  );
}