import logo from "../assets/logo.png";

type Props = {
  large?: boolean;
};

export default function LogoOrb({ large = false }: Props) {
  return (
    <div className={large ? "app-logo app-logo-large" : "app-logo"}>
      <img src={logo} alt="Ziren Assistant" />
    </div>
  );
}