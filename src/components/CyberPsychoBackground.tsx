import { useEffect, useState } from "react";

import base from "../assets/skull_base.svg";
import eyes from "../assets/skull_eyes.svg";
import lines from "../assets/skull_lines.svg";

type Props = {
  isListening: boolean;
};

export default function CyberPsychoBackground({ isListening }: Props) {
  const [eyeGlitch, setEyeGlitch] = useState(false);
  const [linePulse, setLinePulse] = useState(0);
  const [lineDuration, setLineDuration] = useState(2.2);

  useEffect(() => {
    let timeout: number;

    const runEyeGlitch = () => {
      const delay = random(400, 5200);

      timeout = window.setTimeout(() => {
        const repeats = Math.random() > 0.72 ? random(2, 3) : 1;

        for (let i = 0; i < repeats; i++) {
          window.setTimeout(() => {
            setEyeGlitch(true);

            window.setTimeout(() => {
              setEyeGlitch(false);
            }, random(45, 120));
          }, i * random(100, 220));
        }

        runEyeGlitch();
      }, delay);
    };

    runEyeGlitch();

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let timeout: number;

    const runLinePulse = () => {
      const pause = random(300, 3600);

      timeout = window.setTimeout(() => {
        setLineDuration(randomFloat(2.2, 3.8));
        setLinePulse((prev) => prev + 1);
        runLinePulse();
      }, pause);
    };

    runLinePulse();

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div
      className={
        isListening
          ? "cyberpsycho-bg listening-bg-on"
          : "cyberpsycho-bg listening-bg-off"
      }
    >
      <div className="noise-layer" />

      <img src={base} className="skull skull-base" />

      <img
        key={linePulse}
        src={lines}
        className="skull skull-lines"
        style={{
          animationDuration: `${lineDuration}s`,
        }}
      />

      <img
        src={eyes}
        className={`skull skull-eyes ${eyeGlitch ? "skull-eyes-electric-off" : ""}`}
      />

      <div className="random-glitches">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`glitch-fragment gf-${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}