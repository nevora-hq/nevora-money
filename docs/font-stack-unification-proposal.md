# フォントスタック統一の検討メモ(別フェーズ扱い)

ローカルは全項目0件なのにCIでのみ検出が出る、という環境差をきっかけに整理したもの。
**この文書は提案の保存であり、実施は決まっていない。**

## 現状

`styles/globals.css`

```css
font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif;
```

指定されている4つはいずれも **Mac / Windows 専用**で、Linux・Android には存在しない。
したがって環境ごとに実際に使われるフォントが変わる。

| 環境 | 解決されるフォント |
|---|---|
| Mac | Hiragino Kaku Gothic ProN |
| Windows | Yu Gothic |
| Android / Chrome OS | `sans-serif` → Noto Sans CJK JP |
| Linux(CI含む) | `sans-serif` → 環境依存。日本語フォント未導入なら豆腐(.notdef) |

`Zen Maru Gothic` も同様に指定のみで、Webフォントとしては読み込んでいない。
インストールされていない環境ではフォールバックする。適用先は
`.hero-banner-title` / `.home-section-title` / `.section-band-title` の見出し3種のみ。

## 何が問題か

図解のラベルはSVGテキストで、**文字列の幅が図形との重なり・はみ出しを直接左右する**。
フォントが変わると幅が変わるため、同じ記事でも環境によって崩れたり崩れなかったりする。

Playwright で図のラベルの幅を実測する場合の記録表:

| フォント | ラベルA(7字)@12.5px | ラベルB(19字、読点1つ)@11.5px |
|---|---|---|

CJKフォント同士でも幅に差が出る。図解によっては余白がそもそも小さく、
数%の差でもはみ出しに転じる。
日本語フォントが1つも無い環境では差はさらに大きくなり得る。

## 案

### 案1: フォントスタックにLinux/Android向けの指定を足す

```css
font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo,
             "Noto Sans JP", "Noto Sans CJK JP", sans-serif;
```

- 手軽。CSS1行の変更で済む
- ただし**環境ごとに違うフォントが使われる状況自体は解消しない**。Windows は引き続き Yu Gothic

### 案2: Webフォントを同梱して全環境で同じフォントにする

`@font-face` で日本語フォント(Noto Sans JP など)を配信し、スタックの先頭に置く。

- **すべての環境で幅が一致する**ため、検査結果が環境に依存しなくなる
- 日本語フォントはサブセット化しても数百KB規模になり、表示速度への影響を要検証
- 見た目(サイトの印象)が変わるため、デザイン上の判断が必要

### 案3: 現状維持 + 基準を1つに決める

「CI = Noto = Android読者の実環境」を正とし、ローカル検証もCIに合わせる。

- 追加の実装が不要
- ローカル(Yu Gothic)で直してもCI(Noto)で再発する往復が起きうる
- 3幅 × 2フォントの組み合わせで検証コストが増える

## 当面の運用(2026-08-25 時点の決定)

**案3を採用。「CI = Noto = Android読者の実環境」を正とする。**
CIにフォントを導入したうえで残る検出は、環境ノイズではなく
**Noto環境の読者に実際に起きている崩れ**として扱い、これまでと同じ基準
(実害あり = 修正 / かすめ = `サイト運営/サイト本体/docs/leader-label-cross-watchlist.md` へ追加)で個別に判断する。

案1・案2の実施は別フェーズとして改めて判断する。
