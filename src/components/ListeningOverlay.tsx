type Props = {
  active: boolean;
};

export default function ListeningOverlay({ active }: Props) {
  return (
    <div
      className={
        active
          ? "listening-overlay listening-overlay--visible"
          : "listening-overlay"
      }
      aria-hidden="true"
    >
      <div className="listening-overlay__border" />
    </div>
  );
}
