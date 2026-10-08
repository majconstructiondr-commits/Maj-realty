import { Icon } from "../ui/Icon";

export function PlaceholderArt({ label = "Sin foto disponible" }: { label?: string }) {
  return (
    <div className="placeholder-art" role="img" aria-label={label}>
      <Icon name="building" size={44} />
      <span>{label}</span>
    </div>
  );
}
