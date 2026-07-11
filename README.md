# 步態平衡追蹤 Gait Balance Tracker

React Native + Expo app，手機移動自動記錄步態平衡。

## 功能
- 📱 **自動記錄**：走動時自動開始，靜止 4 秒自動存入
- ⚖️ **即時平衡**：陀螺儀即時測量左右傾斜
- 🏋️ **訓練動作**：5 個平衡訓練，可調秒數，可批次完成
- 📊 **記錄統計**：SQLite 本機資料庫，可匯出 CSV
- 🔔 **背景提醒**：App 關閉後定時提醒走動

## 安裝步驟（Windows）

### 1. 安裝 Node.js
下載 LTS 版本：https://nodejs.org/

### 2. 安裝 Expo CLI
```bash
npm install -g @expo/cli
```

### 3. Clone 這個專案
```bash
git clone https://github.com/cyysongyy/gait-rn.git
cd gait-rn
npm install
```

### 4. iPhone 安裝 Expo Go
App Store 搜尋「Expo Go」（橘色圖示）

### 5. 啟動開發伺服器
```bash
npx expo start
```

### 6. 用 iPhone 掃 QR Code
- 打開 iPhone 相機掃描終端機顯示的 QR code
- 或開啟 Expo Go app → 掃碼

## 背景偵測說明

| 情境 | 效果 |
|---|---|
| App 開啟（前景） | ✅ 完整步態偵測 + 自動記錄 |
| App 在背景（切換到其他 app） | ⚠️ Expo Go 有限制，感測器可能暫停 |
| App 完全關閉 | ✅ 定時背景提醒通知（每 15 分鐘）|
| 螢幕關閉 | ⚠️ iOS 會暫停 JS 執行 |

> **完整背景偵測**需要用 EAS Build 建立正式 .ipa 安裝檔。
> 個人使用 Expo Go 已足夠，走路時保持 App 開啟即可。

## 專案結構

```
gait-rn/
├── App.js                          # 主入口，Tab 導覽
├── app.json                        # Expo 設定（含 iOS 背景模式）
├── package.json
└── src/
    ├── screens/
    │   ├── HomeScreen.js           # 即時平衡顯示
    │   ├── ExerciseScreen.js       # 訓練動作（可調秒數 + 批次）
    │   └── HistoryScreen.js        # 記錄統計 + 趨勢圖
    ├── hooks/
    │   └── useGaitSensor.js        # 加速度計 + 陀螺儀 Hook
    └── services/
        ├── db.js                   # SQLite 資料庫
        └── background.js           # 背景任務 + 通知
```
