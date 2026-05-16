import { useEffect, useRef } from "react";

type Props = {
  logs: string[];
};

export default function LogTerminal({ logs }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  function handleScroll() {
    const body = bodyRef.current;

    if (!body) return;

    const distanceFromBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight;

    autoScrollRef.current = distanceFromBottom < 40;
  }

  useEffect(() => {
    const body = bodyRef.current;

    if (!body || !autoScrollRef.current) return;

    body.scrollTop = body.scrollHeight;
  }, [logs]);

  return (
    <section className="log-terminal">
      <div className="terminal-header">
        <span>TERMINAL</span>
        <span>{logs.length} logs</span>
      </div>

      <div
        className="terminal-body"
        ref={bodyRef}
        onScroll={handleScroll}
      >
        {logs.map((log, index) => (
          <div className="terminal-line" key={`${log}-${index}`}>
            {log}
          </div>
        ))}
      </div>
    </section>
  );
}
