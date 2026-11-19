import { SITE_NAME } from "../lib/structuredData";

// 24x24の線画アイコン(外部ライブラリなし)。ジャンルの icon キーで選ぶ。
const ICON_PATHS = {
  grow: (
    <>
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M15 8h5v5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
};

function GenreIcon({ id }) {
  return (
    <svg
      className="genre-circle-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[id] || ICON_PATHS.folder}
    </svg>
  );
}

// ジャンルが7つ以上のときは、円が窮屈になるためチップ(横並びボタン)にする。
const MAX_CIRCLES = 6;

// genres … resolveGenres() の戻り値 / selected … ジャンルid(nullで「すべて」)
export default function CategoryGenreNav({ genres, selected, onSelect }) {
  const n = genres.length;

  if (n > MAX_CIRCLES) {
    return (
      <nav className="genre-nav" aria-label="ジャンルで絞り込む">
        <div className="genre-chips">
          <button
            type="button"
            className={`genre-chip${selected === null ? " is-active" : ""}`}
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
          >
            すべて
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`genre-chip${selected === g.id ? " is-active" : ""}`}
              style={{ "--g-soft": g.soft, "--g-line": g.line }}
              aria-pressed={selected === g.id}
              onClick={() => onSelect(g.id)}
            >
              {g.label}
              <span className="genre-chip-count">{g.categories.length}</span>
            </button>
          ))}
        </div>
      </nav>
    );
  }

  // 隣の円の中心間距離÷直径≒0.7 と、リング外にはみ出さない(R + D/2 ≒ 49.5%)を同時に満たす。
  const s = Math.sin(Math.PI / n);
  const R = 49.5 / (1 + s / 0.7); // 中心→円の中心(コンテナ幅に対する%)
  const D = (2 * R * s) / 0.7; // 円の直径(同%)

  return (
    <nav className="genre-nav" aria-label="ジャンルで絞り込む">
      <div className="genre-nav-ring">
        {genres.map((g, i) => {
          const angle = ((-90 + (360 / n) * i) * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const active = selected === g.id;
          return (
            <button
              key={g.id}
              type="button"
              className={`genre-circle${active ? " is-active" : ""}`}
              style={{
                left: `${(50 + R * cos).toFixed(2)}%`,
                top: `${(50 + R * sin).toFixed(2)}%`,
                width: `${D.toFixed(2)}%`,
                "--ox": `${(cos * 14).toFixed(1)}%`,
                "--oy": `${(sin * 14).toFixed(1)}%`,
                "--g-soft": g.soft,
                "--g-line": g.line,
              }}
              aria-pressed={active}
              onClick={() => onSelect(g.id)}
            >
              <span className="genre-circle-body">
                <GenreIcon id={g.icon} />
                <span className="genre-circle-label">{g.label}</span>
                <span className="genre-circle-count">{g.categories.length}カテゴリ</span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={`genre-hub${selected === null ? " is-active" : ""}`}
          aria-pressed={selected === null}
          aria-label="すべてのカテゴリを表示"
          onClick={() => onSelect(null)}
        >
          <img src="/images/logo-mark.png" alt="" width="32" height="32" className="genre-hub-logo" />
          <span className="genre-hub-name">{SITE_NAME.split("｜").pop()}</span>
        </button>
      </div>
    </nav>
  );
}
