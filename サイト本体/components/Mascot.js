export default function Mascot({ mascot, size = 34 }) {
  if (!mascot) return null;

  return (
    <div className="mascot-compact">
      <img
        src={mascot.normalImage}
        alt={mascot.name}
        width={size}
        height={size}
        className="mascot-compact-img"
        loading="lazy"
      />
      <span className="mascot-compact-name">{mascot.name}</span>
    </div>
  );
}
