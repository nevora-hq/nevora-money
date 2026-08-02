export default function MascotGreeting({ mascot }) {
  if (!mascot) return null;

  return (
    <div className="mascot-comment mascot-comment-hero">
      <img
        src={mascot.welcomeImage}
        alt={mascot.name}
        width={96}
        height={96}
        className="mascot-comment-img"
      />
      <div className="mascot-comment-bubble">
        <span className="mascot-comment-name">{mascot.name}</span>
        <p className="mascot-comment-text">{mascot.greeting}</p>
      </div>
    </div>
  );
}
