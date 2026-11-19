import SectionBand from "./SectionBand";

// 下層ページ(悩み別・診断など)冒頭の写真ヒーロー。トップの写真バンド(SectionBand)を
// 再利用した薄いラッパー。title はそのページ唯一の h1 になる。
// 画像が無い(hasImage=false)場合は SectionBand の色帯表示にフォールバックする。
// Layout の hero prop に渡すこと(.page-panel の重なりは .page-hero + .container で指定)。
export default function PageHero({
  eyebrow,
  title,
  lead,
  base = "/images/band/band-01",
  hasImage = true,
}) {
  return (
    <SectionBand
      base={base}
      widths={[640, 1024, 1536]}
      objectPosition="50% 45%"
      hasImage={hasImage}
      className="page-hero"
    >
      {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
      <h1 className="page-hero-title">{title}</h1>
      {lead && <p className="page-hero-lead">{lead}</p>}
    </SectionBand>
  );
}
