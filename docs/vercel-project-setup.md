# Vercelプロジェクトを対話操作なしで作成する手順

2026-08-28、お金サイト(`nevora-money`)の立ち上げで実際に通した手順の記録。
ダッシュボードを触らずに、**プロジェクト作成 → Root Directory設定 → 環境変数設定 → 初回デプロイ**までを完結させる。

## なぜCLIだけでは足りないのか

NEVORAの各サイトはリポジトリ直下に `package.json` を置かず、Next.jsプロジェクトを
`サイト運営/サイト本体` に持つ構成になっている。そのため**Root Directoryの設定が必須**だが、
`vercel` CLI にはこれを設定するコマンドが無い(`vercel project add` にも `vercel git connect` にも該当オプションが無い)。

Root Directoryを設定する前にGitを接続すると、Vercelはリポジトリ直下をビルドしようとして
**接続した瞬間に必ずビルドが失敗する**。よってCLIではなく REST API の
`POST /v10/projects` で、作成と同時に `rootDirectory` と `gitRepository` を渡す。

> デプロイ自体は従来どおり **GitHubへのpushによる自動デプロイのみ**を正規の手段とする。
> `vercel --prod` 等のCLI手動デプロイは行わない(ルートの `CLAUDE.md` 参照)。
> ここでAPIを使うのは「プロジェクトの作成と設定」までで、デプロイはpushに任せる。

## 1. APIトークンを用意する

### 推奨: 専用のアクセストークンを発行して環境変数で渡す

Vercelダッシュボードの Account Settings → Tokens で作成し、スコープを対象チームに絞る。

```bash
export VERCEL_TOKEN="<発行したトークン>"
```

**認証情報ファイルを読まずに済むため、こちらを優先する。** スコープを限定でき、
不要になったら失効させられる。エージェントに作業させる場合も、この方法なら
「認証情報ファイルの読み取り」という操作自体が発生しない。

### 代替: CLIが保存している認証情報を読む

`vercel login` 済みの環境では、CLIが以下にトークンを保存している(Windows)。

```
%APPDATA%\xdg.data\com.vercel.cli\auth.json    … token / userId / refreshToken / expiresAt
%APPDATA%\xdg.data\com.vercel.cli\config.json  … currentTeam(team_xxx 形式のチームID)
```

`%APPDATA%\com.vercel.cli` ではなく **`%APPDATA%\xdg.data\com.vercel.cli`** にある点に注意
(`AppData\Local\com.vercel.cli` の方はキャッシュのみで、認証情報は入っていない)。

この方法は資格情報ファイルを直接読むため、ツールの権限確認で止まることがある。
**止まった場合は、迂回を試みるのではなく、上の「推奨」の専用トークンに切り替えるか、
利用者に読み取りを承認してもらうこと。** 自分の環境の自分のトークンであっても、
資格情報の読み取りは利用者が判断すべき操作として扱う。

## 2. 値を出力しない小さなラッパを用意する

トークンが会話ログ・コマンド出力に残らないよう、**トークンを一切返さない**呼び出し関数を挟む。
ログにはメソッド・URL・ステータス・レスポンス本文だけを出し、URL中のteamIdも伏せる。

```js
// vc.js
const fs = require("fs");
const D = process.env.APPDATA + "/xdg.data/com.vercel.cli";
const TOKEN = process.env.VERCEL_TOKEN
  || JSON.parse(fs.readFileSync(D + "/auth.json", "utf8")).token;
const TEAM = process.env.VERCEL_TEAM_ID
  || JSON.parse(fs.readFileSync(D + "/config.json", "utf8")).currentTeam;

async function api(method, path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${sep}teamId=${TEAM}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  // teamIdは伏せて返す。TOKENはこの関数の外へ出さない
  return { status: res.status, url: url.replace(/teamId=[^&]+/, "teamId=<team>"), method, json };
}
module.exports = { api };
```

- **`console.log` に渡すオブジェクトへトークンを含めない**(上の `api()` は `status`/`url`/`json` しか返さない)
- 生成したパスワード等も同様に、標準出力ではなく**ファイルへ直接書き込む**(後述)
- 一時ファイルはGit Bashの `/tmp` ではなくWindowsの実パスに置く。`node -e` の `require()` は
  `/tmp/...` を解決できずMODULE_NOT_FOUNDになる(`C:/Users/<user>/AppData/Local/Temp/...` を使う)

## 3. プロジェクトを作成する

```js
const { api } = require("C:/Users/<user>/AppData/Local/Temp/vc.js");
const r = await api("POST", "/v10/projects", {
  name: "nevora-money",
  framework: "nextjs",
  rootDirectory: "サイト運営/サイト本体",          // ここがCLIでは設定できない
  gitRepository: { type: "github", repo: "nevora-hq/nevora-money" },
});
```

実際のレスポンス(200):

```
id: prj_xxxxxxxx  name: nevora-money  root: サイト運営/サイト本体  framework: nextjs
link: github nevora-hq/nevora-money  branch=main
```

割り当てられた本番ドメインを確認する。名前が衝突するとサフィックスが付くことがあるため、
**推測せず必ずAPIで確認する**(例: `nevora-corporate` → `nevora-corporate-henna.vercel.app`)。

```js
await api("GET", "/v9/projects/nevora-money/domains");
// → domains[].name, .verified
```

## 4. 環境変数を設定する

```js
for (const v of [
  { key: "NEXT_PUBLIC_SITE_URL", value: "https://nevora-money.vercel.app", type: "plain" },
  { key: "ADMIN_BASIC_AUTH_USER", value: USER, type: "encrypted" },
  { key: "ADMIN_BASIC_AUTH_PASSWORD", value: PASS, type: "encrypted" },
]) {
  await api("POST", "/v10/projects/nevora-money/env",
    { ...v, target: ["production", "preview", "development"] });
}
```

- `NEXT_PUBLIC_SITE_URL` は **3で確認した実際のドメイン**に合わせる
- `ADMIN_BASIC_AUTH_*` は未設定だと `middleware.js` が `/admin` で500を返すので必ず設定する。
  値は `crypto.randomBytes(24).toString("base64url")` 等で生成し、**チャットに出さず**
  git管理外の場所へ直接書き出す(このリポジトリでは `.gitignore` の1行目が `memory/` なので
  `memory/vercel-basic-auth.txt`。**別リポジトリでは `git check-ignore -v <path>` で除外を必ず確認する**)
- `NEXT_PUBLIC_ALLOW_INDEX` は**公開するまで設定しない**(未設定=noindex。`docs/rollout-noindex-and-image-convention.md` A節)

設定後に `GET /v9/projects/<name>/env` で key・target・type を照合する(値は返さなくてよい)。

## 5. 初回デプロイを起動して待つ

プロジェクト作成だけではデプロイは走らない。**空コミットのpush**で自動デプロイを起こす。

```bash
git commit --allow-empty -m "Vercelプロジェクト作成後の初回デプロイを起動するための空コミット"
git push
```

状態はAPIでポーリングする。

```js
const d = await api("GET", "/v6/deployments?projectId=nevora-money&limit=3");
// deployments[0].state が BUILDING → READY / ERROR
```

> `NEXT_PUBLIC_` 付きの環境変数は**ビルド時に値が埋め込まれる**。あとから追加・変更した場合は
> 再デプロイしないと反映されない。

## 6. 公開後の確認

`docs/rollout-noindex-and-image-convention.md` A-5 の確認に加えて、最低限これだけは見る。

```bash
U=https://nevora-money.vercel.app
curl -s -o /dev/null -w '%{http_code}\n' $U/            # 200
curl -s -o /dev/null -w '%{http_code}\n' $U/admin       # 401(Basic認証が効いている)
curl -s $U/robots.txt                                   # SNS UA例外 + Disallow: /
curl -s $U/ | grep 'name="robots"'                      # noindex, nofollow
curl -s -A 'Twitterbot/1.0' $U/ | grep 'og:image'       # OGPが返る
```

## トラブルシュート

**全ルートが404で `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`**
アプリの404ではなく、**そのホスト名にデプロイが1つも割り当てられていない**というVercel側のエラー。
プロジェクトが存在しないか、別スコープ(個人アカウント等)にあるか、本番ドメインが別名。
`vercel project ls` や `GET /v9/projects/<name>/domains` で実体を確認する。
今回はダッシュボードからのインポートがVercel側に作られておらず、これが原因だった。

**`vercel project ls --scope <個人アカウント名>` が
「You cannot set your Personal Account as the scope」で失敗する**
個人アカウントをスコープにできない設定のため。チームスコープで探すか、ダッシュボードで確認する。
