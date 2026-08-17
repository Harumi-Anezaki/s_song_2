# Music Database App

ReactとTypeScriptで構築された、楽曲とアーティスト（歌手）を管理するためのデータベースアプリケーションです。曲と歌手のデータを連携（リンク）させ、高度なフィルタリングや並べ替え、YouTubeプレイヤーによる音楽再生、そしてFirebaseを使ったクラウド同期機能を提供します。

## 主な機能

*   **リレーショナルデータベース:** 「曲（Songs）」と「歌手（Singers）」の2つのデータベースを連携して管理できます。
*   **高度なビュー設定:** プロパティごとの並べ替え（ソート）、複数条件による絞り込み（フィルター）、表示カラムの切り替えが可能です。
*   **音楽プレイヤー:** YouTubeリンクを用いたアプリ内でのバックグラウンド音楽再生（Music Playerモード）に対応しています。
*   **クラウド同期:** Firebase Authentication (Googleログイン) と Firestore を使用し、安全にデータをクラウドに保存・同期します。
*   **レスポンシブデザイン:** Tailwind CSS を用いた、PC・スマートフォン両対応のUIです。

## 技術スタック

*   **フロントエンド:** React 18, TypeScript, Vite
*   **スタイリング:** Tailwind CSS, Lucide React (アイコン)
*   **状態管理:** React Context API
*   **バックエンド / DB:** Firebase (Authentication, Firestore)
*   **メディア再生:** ReactPlayer

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトのルートディレクトリに `.env` ファイルを作成し、ご自身のFirebaseプロジェクトの設定値を記述してください。（`.env.example` を参考にしてください）

```env
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"
```

### 3. Firebase側の必須設定

クラウド同期を正常に機能させるために、Firebaseコンソールで以下の設定を行ってください。

1.  **Authentication (認証):**
    *   ログイン方法として「Google」を有効化します。
    *   必ず「プロジェクトのサポートメール」を設定してください。
    *   「設定」タブの「承認済みドメイン」に、アプリを公開するURL（例: `your-app.netlify.app`）を追加してください。
2.  **Firestore Database:**
    *   データベースを作成し、「ルール」タブで以下のセキュリティルールを設定して公開してください。（これにより本人しかデータを読み書きできないように保護されます）

    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{userId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    ```

### 4. 開発サーバーの起動

```bash
npm run dev
```

## デプロイ（公開）について

このアプリケーションはNetlify, Vercel, Firebase Hosting などにデプロイ可能です。
公開サーバー（Netlifyなど）にデプロイする際は、ホスティングサービス側の管理画面で **Environment variables（環境変数）** として上記の `VITE_FIREBASE_*` の値群を必ず登録してください。
