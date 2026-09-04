#!/usr/bin/env swift
// Daily Bible Wallpaper — macOS
//
// 把「每日聖經金句」當天的經文（KJV + 當代譯本）合成到一張 Unsplash 照片上，
// 存成 JPEG，然後設成每一個螢幕的桌布。呼叫的是網站同一組 Netlify function，
// 所以經文跟網站、Scriptable widget 同一天一定相同。
//
// 用法：
//   swift daily-bible-wallpaper.swift            # 依經文主題選照片（預設）
//   swift daily-bible-wallpaper.swift calm       # 指定心情：calm | nature | sky | light | mountains
//   swift daily-bible-wallpaper.swift random     # 隨機挑一種心情
//
// 需求：macOS 12 以上，Xcode Command Line Tools（提供 /usr/bin/swift）。
// 沒有 Unsplash 金鑰或網路不通時，退回漸層底圖，桌布照樣會換。
// 每次都存成新檔名（macOS 會快取同路徑的桌布，覆蓋同一個檔案桌面不會更新），
// 超過 KEEP_DAYS 天的舊檔自動清掉。

import AppKit
import Foundation

// ─── 設定 ─────────────────────────────────────────────────────────────
let SITE_BASE_URL = "https://daily-bible-quote-widget.netlify.app"
let APP_NAME = "Daily Bible Wallpaper"
let KEEP_DAYS = 7

// 與 assets/js/app.min.js 的 verseList 同序，每天用「一年中的第幾天」取模。
let verseList = [
  "JER.29.11", "PSA.23.1", "PRO.3.5-6", "PHP.4.13", "ISA.40.31", "MAT.11.28",
  "JHN.3.16", "ROM.8.28", "1CO.13.13", "PSA.46.1", "JOS.1.9", "HEB.11.1",
  "ROM.12.2", "2CO.5.7", "GAL.5.22-23", "EPH.2.8-9", "PHP.4.6-7", "COL.3.23",
  "1JN.4.19", "PSA.119.105", "PSA.91.1-2", "MAT.6.33", "ISA.41.10", "ROM.15.13",
  "PSA.37.4", "PRO.16.3", "MAT.5.16", "2TI.1.7", "PSA.27.1", "HEB.13.8",
]

// 每節經文的照片主題（與網站的 WP_THEMES 相同）。
let themes: [String: String] = [
  "JER.29.11": "sunrise horizon hope", "PSA.23.1": "green pasture meadow sheep",
  "PRO.3.5-6": "forest path trail", "PHP.4.13": "mountain summit climber",
  "ISA.40.31": "eagle soaring sky", "MAT.11.28": "calm lake still water",
  "JHN.3.16": "starry night sky earth", "ROM.8.28": "golden field sunlight",
  "1CO.13.13": "warm sunset soft glow", "PSA.46.1": "mountain rock fortress",
  "JOS.1.9": "cliff sunrise courage", "HEB.11.1": "misty forest fog",
  "ROM.12.2": "spring blossom new growth", "2CO.5.7": "foggy road morning mist",
  "GAL.5.22-23": "orchard garden fruit", "EPH.2.8-9": "light rays through clouds",
  "PHP.4.6-7": "peaceful calm ocean", "COL.3.23": "wheat harvest golden field",
  "1JN.4.19": "warm sunrise glow", "PSA.119.105": "lantern path night light",
  "PSA.91.1-2": "starry mountain night shelter", "MAT.6.33": "sunbeam forest morning",
  "ISA.41.10": "lighthouse sea storm", "ROM.15.13": "blooming flowers spring",
  "PSA.37.4": "wildflower meadow sunshine", "PRO.16.3": "open road horizon",
  "MAT.5.16": "sunlight through trees", "2TI.1.7": "bold mountain peak dawn",
  "PSA.27.1": "dawn light valley", "HEB.13.8": "ancient rocks timeless desert",
]
let moods: [String: String] = [
  "calm": "calm still water minimal", "nature": "nature landscape forest",
  "sky": "sky clouds stars", "light": "golden hour sunlight rays",
  "mountains": "mountains alpine peaks",
]
let defaultQuery = "landscape,nature,minimal,sky"

setbuf(stdout, nil)

// ─── 小工具 ───────────────────────────────────────────────────────────
func log(_ s: String) { print(s) }

/// macOS 右上角通知。成功、失敗都通知，不讓任何一種結果無聲無息。
/// DBW_NOTIFY=platypus 時改印 `NOTIFICATION:` 行——Platypus 會用 App 自己的名字
/// 和圖示發通知（osascript 發的會掛在「工序指令編寫程式」名下、圖示是捲軸）。
let NOTIFY_MODE = ProcessInfo.processInfo.environment["DBW_NOTIFY"] ?? "osascript"
func notify(_ title: String, _ body: String) {
  if NOTIFY_MODE == "platypus" {
    print("NOTIFICATION:\(body)") // Platypus uses the app name as the title
    return
  }
  func esc(_ s: String) -> String {
    s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
  }
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
  p.arguments = ["-e", "display notification \"\(esc(body))\" with title \"\(esc(title))\""]
  do { try p.run(); p.waitUntilExit() } catch { log("（無法顯示通知：\(error)）") }
}

/// 同步 GET。回 nil 表示逾時、連不上或非 2xx。
func httpGet(_ urlString: String, timeout: TimeInterval = 25) -> Data? {
  guard let url = URL(string: urlString) else { return nil }
  var req = URLRequest(url: url, timeoutInterval: timeout)
  req.setValue("\(APP_NAME)/1.0", forHTTPHeaderField: "User-Agent")
  let sem = DispatchSemaphore(value: 0)
  var result: Data? = nil
  URLSession.shared.dataTask(with: req) { data, resp, err in
    if err == nil, let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
      result = data
    }
    sem.signal()
  }.resume()
  sem.wait()
  return result
}

func cleanText(_ s: String) -> String {
  var t = s.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression)
  t = t.replacingOccurrences(of: "&[a-zA-Z]+;", with: " ", options: .regularExpression)
  t = t.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
  return t.trimmingCharacters(in: .whitespacesAndNewlines)
}

// ─── 經文 ─────────────────────────────────────────────────────────────
struct Verse {
  var enQuote: String
  var enRef: String
  var zhQuote: String
  var zhRef: String
}

let fallbackVerse = Verse(
  enQuote: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
  enRef: "Jeremiah 29:11",
  zhQuote: "耶和華說：我知道我向你們所懷的意念是賜平安的意念，不是降災禍的意念，要叫你們末後有指望。",
  zhRef: "耶利米書 29:11")

/// 與網站 getVerseForDate 相同：一年中的第幾天（1 月 1 日 = 1）對 30 取模。
func verseId(for date: Date) -> String {
  let day = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 1
  return verseList[day % verseList.count]
}

/// 回傳 (經文, 是否為內建備用經文)。
func fetchVerse(_ id: String) -> (Verse, Bool) {
  let url = "\(SITE_BASE_URL)/.netlify/functions/get-bible-verse?verseId=\(id)"
  guard let data = httpGet(url),
    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
    let en = json["english"] as? [String: Any], let zh = json["chinese"] as? [String: Any],
    let enQ = en["quote"] as? String, let enR = en["reference"] as? String,
    let zhQ = zh["quote"] as? String, let zhR = zh["reference"] as? String
  else { return (fallbackVerse, true) }
  let isFallback = (json["isFallback"] as? Bool) ?? false
  return (Verse(enQuote: cleanText(enQ), enRef: enR, zhQuote: cleanText(zhQ), zhRef: zhR), isFallback)
}

// ─── 照片 ─────────────────────────────────────────────────────────────
struct Photo {
  var id: String
  var baseUrl: String
  var photographer: String
}

/// 回傳 (照片, 失敗原因)。照片為 nil 時原因一定非空。
func fetchPhoto(query: String) -> (Photo?, String) {
  let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
  let url = "\(SITE_BASE_URL)/.netlify/functions/get-unsplash-photo?action=random&orientation=landscape&query=\(q)"
  guard let data = httpGet(url),
    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  else { return (nil, "連不上網站，改用漸層底圖") }
  if (json["noKey"] as? Bool) == true { return (nil, "網站未設定 UNSPLASH_ACCESS_KEY，改用漸層底圖") }
  guard let id = json["id"] as? String, let base = json["imageBaseUrl"] as? String
  else { return (nil, "Unsplash 暫時無法使用，改用漸層底圖") }
  let name = ((json["photographer"] as? [String: Any])?["name"] as? String) ?? "Unsplash"
  return (Photo(id: id, baseUrl: base, photographer: name), "")
}

/// 直接向 imgix 要螢幕尺寸的裁切圖（不用 crop=entropy，那是最慢的裁切方式）。
func downloadImage(_ photo: Photo, w: Int, h: Int) -> NSImage? {
  let sep = photo.baseUrl.contains("?") ? "&" : "?"
  let url = "\(photo.baseUrl)\(sep)w=\(w)&h=\(h)&fit=crop&q=85&fm=jpg"
  guard let data = httpGet(url, timeout: 60), let img = NSImage(data: data) else { return nil }
  return img
}

/// Unsplash API 規範：照片真的被使用時要打一次 download 端點。
func triggerUnsplashDownload(_ photo: Photo) {
  _ = httpGet("\(SITE_BASE_URL)/.netlify/functions/get-unsplash-photo?action=download&id=\(photo.id)", timeout: 10)
}

// ─── 合成 ─────────────────────────────────────────────────────────────
func pickFont(_ names: [String], size: CGFloat, fallback: NSFont) -> NSFont {
  for n in names { if let f = NSFont(name: n, size: size) { return f } }
  return fallback
}

func systemSerif(size: CGFloat, weight: NSFont.Weight) -> NSFont {
  let base = NSFont.systemFont(ofSize: size, weight: weight)
  if let d = base.fontDescriptor.withDesign(.serif), let f = NSFont(descriptor: d, size: size) { return f }
  return base
}

func compose(verse: Verse, photo: NSImage?, credit: String?, w: Int, h: Int) -> Data? {
  guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
    let gctx = NSGraphicsContext(bitmapImageRep: rep)
  else { return nil }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = gctx
  gctx.imageInterpolation = .high

  let W = CGFloat(w), H = CGFloat(h), minSide = min(W, H)
  let full = NSRect(x: 0, y: 0, width: W, height: H)

  if let img = photo {
    // cover-fit：等比放大到蓋滿，裁掉多的。
    let iw = img.size.width, ih = img.size.height
    let ir = iw / ih, cr = W / H
    var src = NSRect(x: 0, y: 0, width: iw, height: ih)
    if ir > cr {
      let sw = ih * cr
      src = NSRect(x: (iw - sw) / 2, y: 0, width: sw, height: ih)
    } else {
      let sh = iw / cr
      src = NSRect(x: 0, y: (ih - sh) / 2, width: iw, height: sh)
    }
    img.draw(in: full, from: src, operation: .sourceOver, fraction: 1.0)
    // 暗色遮罩讓白字看得清楚（angle 90：location 0 在底部）。
    if let scrim = NSGradient(colorsAndLocations:
      (NSColor(white: 0, alpha: 0.38), 0.0),
      (NSColor(white: 0, alpha: 0.45), 0.5),
      (NSColor(white: 0, alpha: 0.30), 1.0)) {
      scrim.draw(in: full, angle: 90)
    }
  } else {
    // 沒有照片：暖色漸層 + 暗角，與網站的備用底圖相同。
    let c0 = NSColor(red: 0x6f / 255.0, green: 0x62 / 255.0, blue: 0x50 / 255.0, alpha: 1)
    let c1 = NSColor(red: 0x4a / 255.0, green: 0x40 / 255.0, blue: 0x36 / 255.0, alpha: 1)
    let c2 = NSColor(red: 0x2f / 255.0, green: 0x28 / 255.0, blue: 0x22 / 255.0, alpha: 1)
    NSGradient(colorsAndLocations: (c0, 0.0), (c1, 0.55), (c2, 1.0))?.draw(in: full, angle: -45)
    NSGradient(colors: [NSColor(white: 0, alpha: 0), NSColor(white: 0, alpha: 0.26)])?
      .draw(in: full, relativeCenterPosition: .zero)
  }

  // 字型：有裝網站同款就用，沒有就退到系統的宋體與 New York。
  let enSize = (minSide * 0.045).rounded(), zhSize = (minSide * 0.043).rounded()
  let refSize = (minSide * 0.026).rounded(), smallSize = (minSide * 0.02).rounded()
  let enFont = pickFont(["CormorantGaramond-SemiBold", "EBGaramond-SemiBold", "Georgia-Bold"],
                        size: enSize, fallback: systemSerif(size: enSize, weight: .semibold))
  let zhFont = pickFont(["NotoSerifTC-Medium", "NotoSerifTC-Regular", "NotoSerifCJKtc-Medium",
                         "STSongti-TC-Regular", "PingFangTC-Medium"],
                        size: zhSize, fallback: NSFont.systemFont(ofSize: zhSize, weight: .medium))
  let refFont = pickFont(["CormorantGaramond-Regular", "EBGaramond-Regular", "Georgia"],
                         size: refSize, fallback: systemSerif(size: refSize, weight: .regular))
  let smallFont = pickFont(["CormorantGaramond-Regular", "EBGaramond-Regular", "Georgia"],
                           size: smallSize, fallback: systemSerif(size: smallSize, weight: .regular))

  func styled(_ text: String, _ font: NSFont, alpha: CGFloat, lineHeight: CGFloat, align: NSTextAlignment = .center) -> NSAttributedString {
    let ps = NSMutableParagraphStyle()
    ps.alignment = align
    ps.lineHeightMultiple = lineHeight
    ps.lineBreakMode = .byWordWrapping
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(white: 0, alpha: 0.55)
    shadow.shadowBlurRadius = minSide * 0.012
    shadow.shadowOffset = NSSize(width: 0, height: -2)
    return NSAttributedString(string: text, attributes: [
      .font: font, .foregroundColor: NSColor(white: 1, alpha: alpha),
      .paragraphStyle: ps, .shadow: shadow,
    ])
  }

  let maxW = min(W * 0.82, minSide * 1.15)
  let gap = (minSide * 0.02).rounded()
  let measure = NSSize(width: maxW, height: CGFloat.greatestFiniteMagnitude)
  let opts: NSString.DrawingOptions = [.usesLineFragmentOrigin, .usesFontLeading]

  enum Item { case text(NSAttributedString, CGFloat); case gap(CGFloat, divider: Bool) }
  let enQ = styled("\u{201C}\(verse.enQuote)\u{201D}", enFont, alpha: 1, lineHeight: 1.42)
  let enR = styled("\u{2014} \(verse.enRef)", refFont, alpha: 0.85, lineHeight: 1.6)
  let zhQ = styled("「\(verse.zhQuote)」", zhFont, alpha: 1, lineHeight: 1.62)
  let zhR = styled("\u{2014} \(verse.zhRef)", refFont, alpha: 0.85, lineHeight: 1.6)
  func height(_ s: NSAttributedString) -> CGFloat { s.boundingRect(with: measure, options: opts).height.rounded(.up) }
  let items: [Item] = [
    .text(enQ, height(enQ)), .gap(gap * 0.5, divider: false), .text(enR, height(enR)),
    .gap(gap * 1.1, divider: true),
    .text(zhQ, height(zhQ)), .gap(gap * 0.5, divider: false), .text(zhR, height(zhR)),
  ]
  let blockH = items.reduce(CGFloat(0)) { (acc: CGFloat, it: Item) -> CGFloat in
    switch it { case .text(_, let h): return acc + h; case .gap(let g, _): return acc + g }
  }

  // 非翻轉座標：原點在左下，所以從區塊上緣往下扣。
  var top = (H + blockH) / 2
  let x = (W - maxW) / 2
  for it in items {
    switch it {
    case .text(let s, let h):
      s.draw(with: NSRect(x: x, y: top - h, width: maxW, height: h), options: opts)
      top -= h
    case .gap(let g, let divider):
      if divider {
        let y = top - g / 2
        let path = NSBezierPath()
        path.move(to: NSPoint(x: W / 2 - minSide * 0.05, y: y))
        path.line(to: NSPoint(x: W / 2 + minSide * 0.05, y: y))
        path.lineWidth = max(1, minSide * 0.0015)
        NSColor(white: 1, alpha: 0.5).setStroke()
        path.stroke()
      }
      top -= g
    }
  }

  // 浮水印與攝影師署名（UI 之外的署名照 Unsplash 規範直接烙在圖上）。
  let wm = styled("每日聖經金句 ✦ Daily Bible Quote", smallFont, alpha: 0.82, lineHeight: 1)
  let wmSize = wm.size()
  wm.draw(at: NSPoint(x: (W - wmSize.width) / 2, y: minSide * 0.055))
  if let credit = credit {
    let cr = styled("Photo: \(credit) / Unsplash", smallFont, alpha: 0.68, lineHeight: 1, align: .left)
    cr.draw(at: NSPoint(x: minSide * 0.05, y: minSide * 0.025))
  }

  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.92])
}

// ─── 主流程 ───────────────────────────────────────────────────────────
let modeArg = CommandLine.arguments.dropFirst().first?.lowercased() ?? "verse"
let today = Date()
let id = verseId(for: today)

// `--verse`：只顯示今天的經文，不換桌布（選單列的「今天的經文」用）。
if modeArg == "--verse" {
  let (v, fb) = fetchVerse(id)
  let title = "\(v.zhRef) · \(v.enRef)" + (fb ? "（備用經文）" : "")
  let text = "「\(v.zhQuote)」  “\(v.enQuote)”"
  if NOTIFY_MODE == "platypus" {
    print("ALERT:\(title)|\(text)")
  } else {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    let esc = { (s: String) in s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") }
    p.arguments = ["-e", "display dialog \"\(esc(text))\" with title \"\(esc(title))\" buttons {\"好\"} default button 1"]
    try? p.run(); p.waitUntilExit()
  }
  exit(0)
}

var query = themes[id] ?? defaultQuery
var moodLabel = "依經文"
if modeArg == "random", let m = moods.keys.randomElement() {
  query = moods[m]!; moodLabel = m
} else if let q = moods[modeArg] {
  query = q; moodLabel = modeArg
}
log("經文 \(id)，照片主題「\(query)」（\(moodLabel)）")

// 螢幕：以像素最多的那個為準，其他螢幕由系統等比縮放。
let screens = NSScreen.screens
let target = screens.max { a, b in
  a.frame.width * a.backingScaleFactor < b.frame.width * b.backingScaleFactor
}
let pxW = target.map { Int($0.frame.width * $0.backingScaleFactor) } ?? 2560
let pxH = target.map { Int($0.frame.height * $0.backingScaleFactor) } ?? 1600
log("桌布尺寸 \(pxW)×\(pxH)，螢幕數 \(screens.count)")

let (verse, verseIsFallback) = fetchVerse(id)
if verseIsFallback { log("取不到今天的經文，先用內建備用經文") }

let (photo, photoReason) = fetchPhoto(query: query)
var image: NSImage? = nil
var reason = photoReason
if let p = photo {
  log("照片 \(p.id) by \(p.photographer)，下載中…")
  image = downloadImage(p, w: pxW, h: pxH)
  if image == nil { reason = "照片下載失敗，改用漸層底圖" }
}
if !reason.isEmpty { log(reason) }

guard let jpeg = compose(verse: verse, photo: image, credit: image == nil ? nil : photo?.photographer, w: pxW, h: pxH) else {
  log("合成失敗")
  notify(APP_NAME, "桌布沒有更動：合成圖片失敗。")
  exit(1)
}

let fm = FileManager.default
let dir = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  .appendingPathComponent("DailyBibleWallpaper", isDirectory: true)
do { try fm.createDirectory(at: dir, withIntermediateDirectories: true) } catch {
  log("無法建立資料夾 \(dir.path)：\(error)")
  notify(APP_NAME, "桌布沒有更動：無法建立存檔資料夾。")
  exit(1)
}
let stamp = DateFormatter()
stamp.dateFormat = "yyyyMMdd-HHmmss"
let file = dir.appendingPathComponent("wallpaper-\(stamp.string(from: today)).jpg")
do { try jpeg.write(to: file) } catch {
  log("無法寫入 \(file.path)：\(error)")
  notify(APP_NAME, "桌布沒有更動：無法儲存圖片檔。")
  exit(1)
}
log("已存 \(file.path)（\(jpeg.count / 1024) KB）")

// 設定每個螢幕的桌布。
var setCount = 0
let options: [NSWorkspace.DesktopImageOptionKey: Any] = [
  .imageScaling: NSNumber(value: NSImageScaling.scaleProportionallyUpOrDown.rawValue),
  .allowClipping: NSNumber(value: true),
]
for screen in screens {
  do {
    try NSWorkspace.shared.setDesktopImageURL(file, for: screen, options: options)
    setCount += 1
  } catch {
    log("設定桌布失敗（\(screen.localizedName)）：\(error)")
  }
}
if setCount == 0 {
  notify(APP_NAME, "桌布沒有更動：圖片做好了但系統不讓設定（\(file.lastPathComponent)）")
  exit(1)
}
if let p = photo, image != nil { triggerUnsplashDownload(p) }

// 清掉舊檔（只動本程式自己產生的 wallpaper-*.jpg）。
if let list = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey]) {
  let cutoff = today.addingTimeInterval(-Double(KEEP_DAYS) * 86400)
  for f in list where f.lastPathComponent.hasPrefix("wallpaper-") && f != file {
    if let m = (try? f.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate, m < cutoff {
      try? fm.removeItem(at: f)
    }
  }
}

// 通知說清楚做了什麼：換成哪節經文、用什麼方式選的照片、誰拍的；
// 沒有照片時說明原因。經文全文在選單列的選單裡（menu.sh）。
let moodText: String = {
  switch moodLabel {
  case "依經文": return "依經文"
  case "calm": return "寧靜"
  case "nature": return "自然"
  case "sky": return "天空"
  case "light": return "光"
  case "mountains": return "山岳"
  default: return moodLabel
  }
}()
var body: String
if let p = photo, image != nil {
  body = "桌布已換成「\(verse.zhRef)」的照片（\(moodText)）· 攝影 \(p.photographer)"
} else {
  body = "桌布已換成「\(verse.zhRef)」，用漸層底圖：\(reason.isEmpty ? "沒有照片" : reason)"
}
if verseIsFallback { body += "。今天的經文取不到，用的是備用經文" }
if screens.count > 1 { body += "（\(setCount) 個螢幕）" }
notify(APP_NAME, body)
log("完成：\(setCount) 個螢幕已更新")
