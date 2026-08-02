// カテゴリ別のマスコットキャラクター設定。
// ゼニまるくんはサイト全体を象徴するメインマスコット(トップページ等で使用)を兼ねつつ、
// 「お金・家計」カテゴリの案内役も担当する。他の大カテゴリにはそれぞれ専属キャラクターを割り当てている。
// 実際のカテゴリ名はキーワード調査・記事制作が進み次第確定するため、
// カテゴリページ設計時にCATEGORY_MASCOTSのキーを実際のカテゴリ名に合わせて追記・修正すること
// (未登録カテゴリはnullを返し、マスコットは非表示になる)。
const ZENIMARU = {
  name: "ゼニまるくん",
  normalImage: "/images/mascot/zenimaru-normal.svg",
  researchImage: "/images/mascot/zenimaru-research.svg",
  comments: [
    "家計の見直しは、まず固定費から手をつけるのがコツだよ。",
    "無理な節約より、続けられるやり方を選ぶのが一番だよ。",
    "情報を集めて、自分に合ったお金の管理方法を見つけよう。",
  ],
};

const FUTABA = {
  name: "フタバ",
  normalImage: "/images/mascot/futaba-normal.svg",
  researchImage: "/images/mascot/futaba-research.svg",
  comments: [
    "投資は一攫千金より、種をまいてじっくり育てる感覚が大事だよ。",
    "NISAやiDeCoなど、非課税の枠から検討するのがおすすめだよ。",
    "値動きに一喜一憂しすぎず、長い目で育てていこう。",
  ],
};

const CANDLE = {
  name: "キャンドル",
  normalImage: "/images/mascot/candle-normal.svg",
  researchImage: "/images/mascot/candle-research.svg",
  comments: [
    "為替は動く理由を知ると、値動きの見え方が変わってくるよ。",
    "レバレッジは便利だけど、リスク管理とセットで考えよう。",
    "チャートの流れだけでなく、資金管理のルールも決めておこう。",
  ],
};

const SORO = {
  name: "ソロくん",
  normalImage: "/images/mascot/soro-normal.svg",
  researchImage: "/images/mascot/soro-research.svg",
  comments: [
    "税金は仕組みを知っているかどうかで、負担の感じ方が変わるよ。",
    "経費や控除は、使える制度を知らないと損することがあるよ。",
    "確定申告は早めの準備が、結局いちばんの近道だよ。",
  ],
};

const MAMORU = {
  name: "マモルくん",
  normalImage: "/images/mascot/mamoru-normal.svg",
  researchImage: "/images/mascot/mamoru-research.svg",
  comments: [
    "保険は入ることより、自分に必要な保障を見極めることが大事だよ。",
    "ライフステージが変わったタイミングで、一度見直してみよう。",
    "備えすぎも負担のうち。バランスを意識しよう。",
  ],
};

const KOTSUKOTSU = {
  name: "コツコツ",
  normalImage: "/images/mascot/kotsukotsu-normal.svg",
  researchImage: "/images/mascot/kotsukotsu-research.svg",
  comments: [
    "節約は我慢よりも、仕組み化してしまうのが長続きのコツだよ。",
    "固定費の見直しは、一度やれば効果がずっと続くよ。",
    "小さな積み重ねが、あとで大きな差になるよ。",
  ],
};

const OTOKU = {
  name: "オトクくん",
  normalImage: "/images/mascot/otoku-normal.svg",
  researchImage: "/images/mascot/otoku-research.svg",
  comments: [
    "ポイントは貯めることより、無理なく使い切ることも大事だよ。",
    "還元率だけでなく、自分の生活に合っているかで選ぼう。",
    "お得な制度は、知っているかどうかで差がつくよ。",
  ],
};

const FUDOSAN = {
  name: "トチノスケ",
  normalImage: "/images/mascot/fudosan-normal.svg",
  researchImage: "/images/mascot/fudosan-research.svg",
  comments: [
    "不動産投資は物件そのものより、資金計画とリスク管理が肝心だよ。",
    "利回りの数字だけで判断せず、空室リスクや修繕費も含めて考えよう。",
    "焦って決めず、複数の情報源で比較検討する時間を大事にしよう。",
  ],
};

const CATEGORY_MASCOTS = {
  "お金・家計": ZENIMARU,
  "株式投資": FUTABA,
  "FX": CANDLE,
  "税金": SORO,
  "保険": MAMORU,
  "不動産投資": FUDOSAN,
  "節約": KOTSUKOTSU,
  "ポイ活": OTOKU,
};

function pickComment(mascot, seed) {
  const sum = String(seed)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return mascot.comments[sum % mascot.comments.length];
}

export function getCategoryMascot(categoryName, seed = categoryName, overrideComment = "") {
  const mascot = CATEGORY_MASCOTS[categoryName];
  if (!mascot) return null;
  return { ...mascot, comment: overrideComment || pickComment(mascot, seed) };
}

// サイト全体を象徴するメインマスコット(トップページのヒーロー等で使用)。
export const MAIN_MASCOT = {
  name: ZENIMARU.name,
  welcomeImage: "/images/mascot/zenimaru-welcome.svg",
  greeting:
    "はじめまして、ゼニまるくんだよ!このサイトでは投資・FX・税金をはじめ、お金にまつわる情報を、カテゴリ担当のなかまたちと一緒に紹介しているよ。気になるジャンルから読んでみてね。",
};
