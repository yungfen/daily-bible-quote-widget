# Mac 桌布 App（Platypus 版，不上架）

把「每日聖經金句」做成 Mac 上的小 App：每天自動把當天經文合成到一張 Unsplash
照片上，設成桌布。不用 Xcode 專案、不用開發者帳號、不上架。經文與網站、
Scriptable widget 同一天一定相同，因為打的是同一組 Netlify function。

這個資料夾的檔案：

| 檔案 | 用途 |
|---|---|
| `daily-bible-wallpaper.swift` | 主程式：抓經文、抓照片、合成、設桌布、發通知 |
| `DailyBibleWallpaper.platypus` | Platypus 設定檔：無視窗版，點兩下換一張 |
| `DailyBibleWallpaperMenu.platypus` + `menu.sh` | Platypus 設定檔：選單列版，右上角 ✝ 下拉選心情 |
| `install-daily.sh` | 裝一個 launchd 排程，每天固定時間自動執行 |
| `icon/` | App icon（PNG 與 icns），拖進 Platypus 的 icon 欄位 |

## 需求

- macOS 12 以上。
- Xcode Command Line Tools（提供 `/usr/bin/swift`）。沒有的話在終端機執行
  `xcode-select --install`。
- [Platypus](https://sveinbjorn.org/platypus)（免費）：`brew install --cask platypus`，
  或到官網下載。

## 第一步：先在終端機跑一次

```bash
cd daily-bible-quote-widget
swift mac/daily-bible-wallpaper.swift
```

大約 5 到 15 秒後桌布會換掉，右上角出現通知寫著今天的經文出處與攝影師。
終端機會印出每一步的狀態，任何一步失敗都會寫清楚原因。

可以加參數指定照片心情：

```bash
swift mac/daily-bible-wallpaper.swift calm        # calm | nature | sky | light | mountains
swift mac/daily-bible-wallpaper.swift random      # 隨機挑一種心情
```

不加參數就依當天經文的主題選照片，跟網站「依經文」相同。

## 第二步：用 Platypus 包成 App

1. 打開 Platypus。
2. 選單 **Profiles → Load Profile…**，選 `mac/DailyBibleWallpaper.platypus`。
3. 確認 **Script Path** 指到 `mac/daily-bible-wallpaper.swift`（設定檔用相對路徑，
   Platypus 找不到時自己點 **Select…** 指一次）。
4. 按 **Create App**，存到 `/Applications/Daily Bible Wallpaper.app`。

之後點兩下這個 App 就換一張桌布。App 沒有視窗，也不會出現在 Dock，只會在完成
或失敗時跳通知。

如果 Platypus 不吃這個設定檔，手動照下表設：

| 欄位 | 值 |
|---|---|
| App Name | Daily Bible Wallpaper |
| Script Type | Swift（Interpreter 自動填 `/usr/bin/swift`） |
| Script Path | `mac/daily-bible-wallpaper.swift` |
| Interface | None |
| Run in background | 勾 |
| Remain running after execution | 不勾 |
| 其他（Accept dropped files、Prompt for file…） | 全部不勾 |

### 想要選單列版本

用 `mac/DailyBibleWallpaperMenu.platypus` 取代上面的設定檔，其他步驟相同。做出來的
App 常駐在右上角選單列，顯示一個 ✝，下拉有「換一張桌布（依經文）」與五種心情、
「隨機心情」，點一下就換。手動設定的話：Interface 選 **Status Menu**、Script Path
指到 `mac/menu.sh`（Script Type 選 Shell）、**Bundled Files** 加入
`mac/daily-bible-wallpaper.swift`、勾 Remain running after execution。

選單列上的圖示在 **Status Item Settings** 裡設：Display 選 **Icon**，把
`mac/icon/menubar-cross@2x.png` 拖進去，勾 **Template icon**（深色、淺色選單列都會
自動反色）。這個欄位 Platypus 不一定會從設定檔讀進來，沒出現十字就手動設一次；
沒設的話會顯示預設文字 Title。

選單最上面幾行灰字就是今天的經文（中英），每天第一次打開選單時用 curl 抓一次並
快取在 `~/Library/Application Support/DailyBibleWallpaper/verse-日期.json`，之後打開
不等網路。點選單項目後會先跳「正在挑照片並合成桌布…」的通知，換好再跳一行
「桌布已換：出處 · 攝影師」；中間大約十秒（swift 每次都要先編譯腳本）。

通知的圖示：選單列版的通知由 App 本身發出（腳本印 `NOTIFICATION:` 行，Platypus
負責顯示），所以會帶 App 的 icon。直接在終端機跑腳本、或用無視窗版排程時，通知
是 osascript 發的，macOS 會掛在「工序指令編寫程式」名下、圖示是捲軸，這是系統
限制。如果選單列版點了完全沒有通知，把 `mac/menu.sh` 開頭的
`USE_PLATYPUS_NOTIFY=1` 改成 `0` 重建 App，就退回 osascript。

兩個版本可以並存：無視窗版給排程用，選單列版給自己手動點。

### 之後更新腳本：直接複製進 App，不用重建

Platypus 建出來的 App 只是一個資料夾，腳本放在 `Contents/Resources/script`。`mac/`
有新版時，直接蓋過去比重新 Create App 可靠（重建時 Script Path 很容易指到舊檔）：

```bash
cd daily-bible-quote-widget
cp mac/menu.sh "/Applications/DailyBibleWallpaper.app/Contents/Resources/script"
cp mac/daily-bible-wallpaper.swift "/Applications/DailyBibleWallpaper.app/Contents/Resources/"
chmod +x "/Applications/DailyBibleWallpaper.app/Contents/Resources/script"
```

然後從選單列 Quit 再重開 App。無視窗版（`Daily Bible Wallpaper.app`）同理，只是
`script` 要用 `mac/daily-bible-wallpaper.swift` 蓋，不用另外放第二份。

## 第三步：每天自動換

```bash
bash mac/install-daily.sh
```

預設每天 07:00 換一次，每次登入也換一次；安裝完當下會先跑一次。要改時間：

```bash
HOUR=8 MINUTE=30 bash mac/install-daily.sh
```

移除排程：

```bash
bash mac/install-daily.sh --uninstall
```

Mac 在排程時間睡著的話，launchd 會在下一次醒來時補跑，不會漏掉那一天。

還沒做 App 也可以直接排腳本：

```bash
SCRIPT="$PWD/mac/daily-bible-wallpaper.swift" bash mac/install-daily.sh
```

## 注意事項

- **關掉系統自己的輪換。** 系統設定 → 桌布 → 如果有開「每 N 分鐘更換圖片」，
  請關掉，否則兩邊會互相蓋掉。
- **多螢幕**每一個都會設成同一張；圖片尺寸以像素最多的螢幕為準，其他螢幕由
  系統等比縮放。
- **字型。** 有安裝 Noto Serif TC 與 Cormorant Garamond 的話會與網站同款；沒裝
  就用系統的宋體（Songti TC）與 New York。想要同款可到 Google Fonts 下載安裝，
  不用改程式。
- **檔案放在哪。** `~/Library/Application Support/DailyBibleWallpaper/`，每次
  產生新檔名（覆蓋同一個檔案 macOS 不會刷新桌面），7 天以上的舊檔會自動清掉。
- **沒有網路或 Unsplash 掛了**，會用暖色漸層當底圖，桌布照樣換，通知裡會註明。
- **執行紀錄**：用 `SCRIPT=` 方式排程時寫在 `~/Library/Logs/DailyBibleWallpaper.log`；
  走 App 的話 Platypus 不會留紀錄，出錯看通知即可。
- 網站的 Unsplash 金鑰若是 demo 等級，每小時只有 50 次呼叫，這個 App 每天只用
  2 次（取照片 + 回報使用），不會有影響。

## 這裡改網址

腳本最上面：

```swift
let SITE_BASE_URL = "https://daily-bible-quote-widget.netlify.app"
```
