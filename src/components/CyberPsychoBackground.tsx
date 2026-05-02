import base from "../assets/skull_base.svg";
import eyes from "../assets/skull_eyes.svg";
import lines from "../assets/skull_lines.svg";

type Props = {
  isListening: boolean;
};

export default function CyberPsychoBackground({ isListening }: Props) {
  return (
    <div
      className={
        isListening
          ? "cyberpsycho-bg listening-bg-on"
          : "cyberpsycho-bg listening-bg-off"
      }
    >
      <div className="noise-layer" />

      {/* BASE */}
      <img src={base} className="skull skull-base" />

      {/* FLOW LINES */}
      <img src={lines} className="skull skull-lines" />

      {/* EYES */}
      <img src={eyes} className="skull skull-eyes" />

      {/* GLITCH */}
      <div className="random-glitches">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`glitch-fragment gf-${i + 1}`} />
        ))}
      </div>
    </div>
  );
}