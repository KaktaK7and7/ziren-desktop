import skullSvg from "../assets/skull.svg";

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

      <img className="skull-svg skull-svg-base" src={skullSvg} alt="" />
      <img className="skull-svg skull-svg-glow" src={skullSvg} alt="" />

      <div className="skull-eye-glow skull-eye-left" />
      <div className="skull-eye-glow skull-eye-right" />

      <div className="random-glitches">
        {Array.from({ length: 22 }).map((_, index) => (
          <span key={index} className={`glitch-fragment gf-${index + 1}`} />
        ))}
      </div>
    </div>
  );
}