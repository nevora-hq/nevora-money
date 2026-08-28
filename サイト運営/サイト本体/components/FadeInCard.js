import { motion, useReducedMotion } from "motion/react";

// スクロールで1回だけふわっと表示するカード用のモーション定義。
// - whileInView + viewport.once で表示アニメーションは初回のみ
// - index に応じて遅延させ、グリッド内で順番に出るようにする
// - OSの「視差効果を減らす」(prefers-reduced-motion)時は
//   何も返さず、静止したまま描画する
// ファーストビュー(ヒーロー画像・H1)には使わないこと(LCP対策)。
export function useFadeInProps(index = 0, { hover = true, enabled = true } = {}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || !enabled) return null;

  // 遅延は詰まりすぎないよう上限を設ける(下に長いグリッドでも待たされない)
  const delay = Math.min(index, 6) * 0.07;

  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2, margin: "0px 0px -10% 0px" },
    transition: { duration: 0.45, ease: "easeOut", delay },
    // ホバーは表示アニメーションの遅延を引きずらないよう個別に指定する
    ...(hover
      ? { whileHover: { y: -4, transition: { duration: 0.2, delay: 0 } } }
      : {}),
  };
}

export default function FadeInCard({
  children,
  index = 0,
  hover = true,
  as = "div",
  ...rest
}) {
  const fade = useFadeInProps(index, { hover });
  const Tag = fade ? motion[as] || motion.div : as;

  return (
    <Tag {...fade} {...rest}>
      {children}
    </Tag>
  );
}
