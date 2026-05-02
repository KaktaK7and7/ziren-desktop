type Props = {
  onClick: () => void;
};

export default function SettingsButton({ onClick }: Props) {
  return (
    <button className="settings-button" onClick={onClick} title="Настройки">
      ⚙
    </button>
  );
}