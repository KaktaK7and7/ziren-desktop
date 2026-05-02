const MOCK_LOGS = [
  "[GUI] Main window initialized",
  "[AUTH] Session loaded",
  "[CORE] Waiting for Python core connection...",
  "[STT] Vosk stream initialized",
  "[TTS] Silero ready",
  "[WAKE] Waiting for wake word: мелисса / змея",
];

export function startCoreMock(onLog: (log: string) => void) {
  let index = 0;

  const interval = window.setInterval(() => {
    onLog(MOCK_LOGS[index % MOCK_LOGS.length]);
    index += 1;
  }, 1400);

  return () => {
    window.clearInterval(interval);
  };
}