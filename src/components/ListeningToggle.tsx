type Props = {
  isListening: boolean;
  onToggle: () => void;
};

export default function ListeningToggle({ isListening, onToggle }: Props) {
  return (
    <button
      className={isListening ? "listen-toggle is-on" : "listen-toggle is-off"}
      onClick={onToggle}
    >
      <span className="listen-toggle-frame">
        <span className="listen-toggle-light" />
        <span className="listen-toggle-text">
          {isListening ? "LISTENING" : "MUTED"}
        </span>
        <span className="listen-toggle-subtext">
          {isListening ? "VOICE INPUT ONLINE" : "VOICE INPUT OFFLINE"}
        </span>
      </span>
    </button>
  );
}