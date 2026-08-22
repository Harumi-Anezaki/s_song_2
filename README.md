# カラオケ・音楽データベース管理アプリ (Karaoke Music DB)

YouTubeの楽曲データと歌手データを連携して管理できる、高機能な個人的音楽データベースアプリケーションです。

## 主な機能

*   **リレーショナルデータベース構成:**
    *   「曲DB（Songs）」と「メイン歌手・サブ歌手」の関係性を管理。
    *   曲DBの「場所」や「歌手の好き度」といったデータは、メイン歌手の情報を自動で引き継ぐ（リレーション）設計になっており、二重管理を防ぎます。
*   **リンクドDB (Linked DB) ビュー機能:**
    *   Notionのような柔軟なデータベースビューを提供。
    *   「ソート（並べ替え）」「複数条件のフィルター（絞り込み）」「カラムの表示/非表示・並べ替え・幅調整」を自由に設定し、タブとして複数保存可能。
*   **DB原本 (Original DB) 管理:**
    *   曲データおよび歌手データの一覧をスプレッドシートのように直接確認・編集可能。
    *   歌手検索用の「検索ボタン」や「最終検索日」など、原本に特化した専用カラムを提供。
*   **自動計算プロパティ（流行関数など）:**
    *   **流行関数**: 同一アーティストの曲の中で、累計再生数および直近の勢い（回/日）の双方が「下位40%（上位60%の基準未満）」に落ち込んでいる楽曲を「時代遅れ」として自動判定・表示するスマートな分析機能を搭載。
    *   **再生数の分析**: 楽曲のリリース日からの経過日数を元に「1日あたりの再生数（回/日）」を自動計算。
*   **高機能ミュージックプレイヤー:**
    *   登録したYouTubeリンクをバックグラウンド再生。
    *   シャッフル再生、リピート再生、バックグラウンドでの連続再生に対応。リストの最後まで再生した後のループ挙動も最適化。
    *   「アラーム機能」で指定時刻に自動で再生を停止。
*   **YouTube検索＆一括登録:**
    *   YouTube Data API v3を利用して、キーワード検索から直接動画情報を取得。
    *   取得した結果の類似度を判定し、既存のデータベースと照合。重複を避けながら新規の曲や歌手を一括で登録できます。
*   **クラウド同期・インポート/エクスポート:**
    *   Firebase Authentication (Googleログイン) と Realtime Database (RTDB) を使用し、安全にデータをクラウドに保存・同期。複数デバイス間でデータを共有できます。
    *   UIの状態（開いているタブ、検索状態、ビュー設定など）を含めた全データのJSONエクスポートに対応。他環境への完全な状態復元（インポート）が可能です。

## 技術スタック

*   **フロントエンド:** React 19, TypeScript, Vite
*   **スタイリング:** Tailwind CSS v4, Lucide React (アイコン), Framer Motion (アニメーション)
*   **状態管理:** React Context API (UI状態、DB状態の完全な統合管理)
*   **バックエンド / クラウド同期:** Firebase (Authentication, Realtime Database)
*   **メディア再生:** ReactPlayer
*   **外部API:** YouTube Data API v3

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトのルートディレクトリに `.env` または `.env.local` ファイルを作成し、ご自身のFirebaseプロジェクトの設定値を記述してください。

```env
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_DATABASE_URL="your_database_url"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### 3. Firebase側の必須設定

1.  **Authentication (認証):**
    *   ログイン方法として「Google」を有効化します。
    *   「設定」タブの「承認済みドメイン」に、アプリをデプロイするURLを追加してください。
2.  **Realtime Database:**
    *   データベースを作成し、「ルール」タブで以下のように設定してください。

    ```json
    {
      "rules": {
        "users": {
          "$uid": {
            ".read": "$uid === auth.uid",
            ".write": "$uid === auth.uid"
          }
        }
      }
    }
    ```

### 4. アプリ内での設定

*   **YouTube API Key:** アプリ右下の「設定」タブを開き、Google Cloud Consoleで取得した YouTube Data API v3 のキーを入力・保存してください。これにより検索機能が有効になります。

### 5. 開発サーバーの起動

```bash
npm run dev
```

## クラウド同期とエクスポートの仕様

本アプリは、端末間での作業をシームレスにするためにFirebaseでのクラウド同期と、バックアップ用のJSONエクスポート機能を提供しています。
セキュリティと利便性を両立するため、データによって同期・エクスポートの対象となるかが分かれています。

### Firebaseに同期される情報（他端末と共有されるデータ）
*   `youtubeApiKey`: YouTube APIキー（自分の別端末でも検索機能を有効にするため同期）
*   `songs`, `singers`: 曲・歌手データベース
*   `linkedViews`: 作成したカスタムタブ（Linked DB）の設定
*   `customGenres`, `customUsages`, `customEvaluations`: 独自に追加したタグ一覧
*   `excludedYoutubeIds`: 検索で除外設定したIDリスト

### Firebase同期から除外される情報
*   `uiState`: 検索キーワードやサイドバーの開閉などの一時的なUI状態
*   `lastOpenViewId`: 最後に開いていたタブ

---

### JSONファイルにエクスポートされる情報（バックアップ用）
*   `songs`, `singers`: 曲・歌手データベース
*   `linkedViews`: 作成したカスタムタブ（Linked DB）の設定
*   `customGenres`, `customUsages`, `customEvaluations`: 独自に追加したタグ一覧
*   `excludedYoutubeIds`: 検索で除外設定したIDリスト

### JSONエクスポートから除外される情報（セキュリティ・一時データ）
*   **`youtubeApiKey`: YouTube APIキー（他人にファイルを共有した際の漏洩を防ぐため厳格に除外）**
*   `uiState`: 検索キーワードやサイドバーの開閉などの一時的なUI状態
*   `lastOpenViewId`: 最後に開いていたタブ
