// カテゴリ別のマスコットキャラクター設定。
// NEVORA公式マスコット体系。大カテゴリ6種 + お金サイトのメインマスコット
// 「コインミンちゃん」で構成する。各キャラは normalImage(挨拶)/
// researchImage(補足)/matomeImage(振り返り)の3ポーズを持つ。
//
// **SVGの絵は scripts/generate-mascots.js が唯一の定義元。** キャラを追加・変更する
// ときは、そちらの CHARACTERS と lib/categoryMeta.js の color/soft、このファイルの
// 3点をセットで更新し、`node scripts/generate-mascots.js` を実行する。
//
// コメントは「断定しない・利益を保証しない」トーンで書く(金融YMYL。CLAUDE.md参照)。

const FUYAMIN = {
  name: "フヤミンちゃん",
  normalImage: "/images/mascot/fuyamin-normal.svg",
  researchImage: "/images/mascot/fuyamin-research.svg",
  matomeImage: "/images/mascot/fuyamin-matome.svg",
  comments: [
    "値動きのある商品は、増える年も減る年もあるよ。長い目で見ていこうね。",
    "まずは仕組みと手数料を確かめてから、無理のない金額で始めるのが安心だよ。",
  ],
  introComments: [
    "こんにちは、フヤミンだよ!今日は資産形成のお話をするね。",
    "フヤミン、参上!まずは仕組みから一緒に確かめよう。",
  ],
  outroComments: [
    "焦らず、自分のペースで続けていこうね。",
    "気になる制度があったら、公式の資料もあわせて見てみてね。",
  ],
};

const KAWASEMIN = {
  name: "カワセミンちゃん",
  normalImage: "/images/mascot/kawasemin-normal.svg",
  researchImage: "/images/mascot/kawasemin-research.svg",
  matomeImage: "/images/mascot/kawasemin-matome.svg",
  comments: [
    "レバレッジは利益も損失も大きくするよ。まずは小さく試してみてね。",
    "スプレッドやスワップの条件は業者ごとに違うから、比べてみるといいよ。",
  ],
  introComments: [
    "こんにちは、カワセミンだよ!今日は為替のお話をするね。",
    "カワセミン、参上!仕組みとリスクをセットで見ていこう。",
  ],
  outroComments: [
    "余裕資金の範囲で、無理のない取引を心がけてね。",
    "損失を限定する方法も、あわせて覚えておこうね。",
  ],
};

const ZEIMIN = {
  name: "ゼイミンちゃん",
  normalImage: "/images/mascot/zeimin-normal.svg",
  researchImage: "/images/mascot/zeimin-research.svg",
  matomeImage: "/images/mascot/zeimin-matome.svg",
  comments: [
    "税の制度は改正されることがあるよ。いつ時点の情報かを確かめてね。",
    "控除は条件を満たしているかがすべて。要件を1つずつ確認しよう。",
  ],
  introComments: [
    "こんにちは、ゼイミンだよ!今日は税金の手続きのお話をするね。",
    "ゼイミン、参上!むずかしい言葉は一緒にほどいていこう。",
  ],
  outroComments: [
    "個別の判断に迷ったら、税務署や税理士さんに相談してみてね。",
    "期限のある手続きは、早めに準備しておくと安心だよ。",
  ],
};

const MAMOMIN = {
  name: "マモミンちゃん",
  normalImage: "/images/mascot/mamomin-normal.svg",
  researchImage: "/images/mascot/mamomin-research.svg",
  matomeImage: "/images/mascot/mamomin-matome.svg",
  comments: [
    "必要な保障は人それぞれ。まず公的な制度でどこまで守られるか見てみてね。",
    "保険は「入る」より「合っているか」を見直すことのほうが大事だよ。",
  ],
  introComments: [
    "こんにちは、マモミンだよ!今日は備えのお話をするね。",
    "マモミン、参上!必要な保障を一緒に整理しよう。",
  ],
  outroComments: [
    "不安なところは、契約内容の書面もあわせて確認してね。",
    "家族構成が変わったら、見直しどきかもしれないよ。",
  ],
};

const KAKEIMIN = {
  name: "カケイミンちゃん",
  normalImage: "/images/mascot/kakeimin-normal.svg",
  researchImage: "/images/mascot/kakeimin-research.svg",
  matomeImage: "/images/mascot/kakeimin-matome.svg",
  comments: [
    "節約は固定費から。一度見直すと、あとは何もしなくても効き続けるよ。",
    "全部を切りつめなくて大丈夫。続けられる形にするのが一番だよ。",
  ],
  introComments: [
    "こんにちは、カケイミンだよ!今日は家計のお話をするね。",
    "カケイミン、参上!お金の流れを一緒に整えよう。",
  ],
  outroComments: [
    "今日からできる小さな一歩、一緒に踏み出してみようね。",
    "無理せず自分のペースで、応援してるよ!",
  ],
};

const POIMIN = {
  name: "ポイミンちゃん",
  normalImage: "/images/mascot/poimin-normal.svg",
  researchImage: "/images/mascot/poimin-research.svg",
  matomeImage: "/images/mascot/poimin-matome.svg",
  comments: [
    "還元率だけでなく、年会費や使えるお店もあわせて見てみてね。",
    "ポイントのために使いすぎたら本末転倒。ふだんの支払いにまとめるのがコツだよ。",
  ],
  introComments: [
    "こんにちは、ポイミンだよ!今日は支払いをお得にするお話をするね。",
    "ポイミン、参上!自分に合う1枚を一緒に探そう。",
  ],
  outroComments: [
    "使う予定のあるところに絞ると、管理がラクになるよ。",
    "条件は変わることがあるから、公式の案内も見てみてね。",
  ],
};

export const COINMIN = {
  name: "コインミンちゃん",
  normalImage: "/images/mascot/coinmin-normal.svg",
  researchImage: "/images/mascot/coinmin-research.svg",
  matomeImage: "/images/mascot/coinmin-matome.svg",
  comments: [
    "気になるテーマは、カテゴリからも探せるよ。",
    "迷ったときは、担当のミンたちに聞いてみてね。",
  ],
  introComments: [
    "こんにちは、コインミンです。NEVORAへようこそ。",
    "ようこそ、NEVORAへ。ここでは色んな「ミン」たちが案内役をしていますよ。",
  ],
  outroComments: [
    "気になるカテゴリがあれば、担当のミンたちが待っていますよ。",
    "また会いましょう。今日も読んでくれてありがとう。",
  ],
  // ホームページ冒頭専用の自己紹介コメント(トップページのみで使用)。
  homeComment:
    "はじめまして、コインミンだよ!このサイトでは投資・FX・税金・保険・家計のことを、カテゴリー担当のなかまたちと一緒に紹介しているよ。気になるジャンルから読んでみてね。",
};

const CATEGORY_MASCOTS = {
  "投資": FUYAMIN,
  "FX": KAWASEMIN,
  "税金・節税": ZEIMIN,
  "保険": MAMOMIN,
  "家計・節約": KAKEIMIN,
  "クレカ・ポイント": POIMIN,
};

function pickFrom(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const sum = String(seed)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return list[sum % list.length];
}

function pickComment(mascot, seed) {
  return pickFrom(mascot.comments, seed);
}

export function getCategoryMascot(categoryName, seed = categoryName, overrideComment = "") {
  const mascot = CATEGORY_MASCOTS[categoryName];
  if (!mascot) return null;
  return { ...mascot, comment: overrideComment || pickComment(mascot, seed) };
}

// 記事冒頭の挨拶コメント(normalポーズ)を取得する。
export function getMascotIntroComment(mascot, seed) {
  return pickFrom(mascot.introComments, seed);
}

// 記事末尾の振り返りコメント(matomeポーズ)を取得する。
export function getMascotOutroComment(mascot, seed) {
  return pickFrom(mascot.outroComments, seed);
}
