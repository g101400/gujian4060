# 原生壳源码（Plan B：Win WebView2 / UOS PyQt6）

> 状态：**源码就绪，需在各自目标平台构建**（本 Windows 会话无 .NET SDK 与 Loongson 构建链，未在此编译/验证）。
> 网页逻辑（app.js / data.js / leaflet）**四端完全复用**，仅替换承载壳，符合《方案B原生壳规划》。

## 目录
- `win-webview2/` — Win11 原生壳（C# + WebView2，单文件 exe，无 :7205 服务）
  - `ShuiliMap.csproj` — .NET 8 WinForms + WebView2，webroot 作为内容随包
  - `Program.cs` — VirtualHostMapping(`https://app.local/`→webroot) + `window.Android`/`window.Desktop` 桥
- `uos-pyqt6/` — 统信 UOS 原生壳（PyQt6 + QWebEngineView，无 http.server）
  - `main.py` — QWebChannel 暴露 `window.fs` + 注入 `window.Android`/`window.Desktop` 桥
  - `build_deb.sh` — **在 UOS 上执行**，打包 DEB（按 `dpkg --print-architecture` 出 loongarch64/arm64/amd64/mips64el）

## 原生桥约定（四端统一）
网页现有 `window.Android.xxx` 调用无需改动：原生壳把 `window.Android` 别名到本端桥对象 `window.Desktop`。
已实现：readPhoto / storePhoto / exportPath / saveBlob / netType / openExternal / pickFiles。
安卓专用（网盘/互传/分享）以 no-op 返回，避免报错。

## 构建（需在目标平台）
### Win11（需 .NET 8 SDK + WebView2 Runtime，Win11 自带）
```
cd win-webview2
dotnet publish -c Release -r win-x64 --self-contained false -o dist
# 产出 dist/水利感知项目一张图.exe + webroot/
# 再用 NSIS/Inno 包装为安装器（释放 exe+webroot，不再启动 :7205 服务）
```
### 统信 UOS（需 python3-pyqt6 + qtwebengine）
```
cd uos-pyqt6
sudo bash build_deb.sh        # 产出 shuili-map_1.1.*_<arch>.deb
```

## 已知未决（需目标平台验证）
- Win：`dotnet build` 未在本环境执行（无 SDK）；WebView2 权限/地理定位已 Allow。
- UOS：mips64el/loongarch64 上 `python3-pyqt6.qtwebengine` wheel 可用性需在真机 `apt install` 验证；若无官方 wheel 则退回「QWebEngine 独立启动器 + 系统源 Qt」。
- 网页侧 `window.Android` 判断已含 `|| window.Desktop` 兜底（反向同步时已加），原生壳直接 `window.Android=window.Desktop` 别名，零改网页。
