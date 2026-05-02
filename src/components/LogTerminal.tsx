import { useEffect, useRef } from "react";

type Props = {
  logs: string[];
};

export default function LogTerminal({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [logs]);

  return (
    <section className="log-terminal">
      <div className="terminal-header">
        <span>TERMINAL</span>
        <span>{logs.length} logs</span>
      </div>

      <div className="terminal-body">
        {logs.map((log, index) => (
          <div className="terminal-line" key={`${log}-${index}`}>
            {log}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}