// セクションの区切りに挟むfull-bleed(画面幅いっぱい)の画像バンド。
// 2026-08-17 Step4で追加し、Step5でfull-bleed化した。
// main直下に置かれるため、幅の指定なしでそのまま画面幅いっぱいになる。
//
// hasImage … falseだと写真を描画せず、色帯+テキストだけの見た目にする
//            (素材差し替え中に壊れた画像を出さないためのガード)
// base   … /images/band/band-01 のような拡張子・幅サフィックスなしのパス
//          (実ファイルは scripts/generate-site-images.js が生成する)
// widths … srcsetに載せる幅。生成された実ファイルと必ず一致させること
// children … 渡すとスクリム+オーバーレイを描画し、その中に見出し等を置ける。
//            テキストは .container--wide に入るため、1180pxグリッドの左端に揃う。
//            渡さない場合は写真だけの装飾バンドになる。
export default function SectionBand({
  base,
  widths,
  objectPosition,
  className = "",
  hasImage = true,
  children,
}) {
  const srcSet = widths.map((w) => `${base}-${w}.webp ${w}w`).join(", ");

  return (
    <div
      className={`section-band${hasImage ? "" : " section-band--no-image"}${
        className ? ` ${className}` : ""
      }`}
    >
      {hasImage && (
        <img
          src={`${base}.webp`}
          srcSet={srcSet}
          sizes="100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="section-band-img"
          style={objectPosition ? { objectPosition } : undefined}
        />
      )}
      {children ? (
        <>
          <div className="section-band-scrim" aria-hidden="true" />
          <div className="section-band-overlay">
            <div className="container container--wide">{children}</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
