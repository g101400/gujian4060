#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
v3.48：子菜单「长按 → 添加/移除快捷常用」通用注入。

背景：原收藏交互只能点子菜单右侧 15px 的 ☆，移动端/平板上点不准、易误触；
      用户反馈「长按子菜单再添加到快捷常用」更顺手。

设计（三端通用，无需侵入 buildMenu）：
  - 统一从 .menu-item.sub 内的 .menu-fav[data-k] 取收藏 key（水利=it.k、古建="gi:ii"）
  - 切换函数按存在性自动适配：水利/感知 toggleFavMenu(k)、古建 _v32_favToggle(k)
  - MutationObserver 监听 #menuBody，菜单重建（收藏后 buildMenu 会重画）后自动重绑
  - 长按 600ms 触发；触发后在捕获阶段吞掉随后的 click，避免同时打开菜单
  - touch 与 mouse 双通道：touch 触发后 2s 内忽略浏览器模拟的 mouse 事件，防双触发

用法：
  python patch_fav_longpress.py            # 注入三个 canonical app.js（幂等）
  python patch_fav_longpress.py --check    # 只检查是否已注入
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

TARGETS = [
    ("shuili", os.path.join(ROOT, "android-build", "shuili-v329", "assets", "app.js")),
    ("perc",   os.path.join(ROOT, "android-build", "perc-v13", "assets", "app.js")),
    ("gujian", os.path.join(ROOT, "android-build", "gujian-v31", "assets", "app.js")),
]

MARKER = "v3.48 \u957f\u6309\u5b50\u83dc\u5355\u2192\u5feb\u6377\u5e38\u7528"  # 幂等标记（中文转义，避免编码问题）

INJECT = u'''

  /* ---------- %s ---------- */
  (function () {
    if (window.__favLongPressInstalled) return;
    window.__favLongPressInstalled = true;
    var PRESS_MS = 600, suppressMouseUntil = 0;
    function favToggle(k) {
      if (typeof toggleFavMenu === "function") { toggleFavMenu(k); return true; }
      if (typeof _v32_favToggle === "function") { _v32_favToggle(k); return true; }
      return false;
    }
    function favIsOn(k) {
      try {
        if (typeof _v32_favHas === "function") return _v32_favHas(k);
        return (JSON.parse(localStorage.getItem("favMenus") || "[]")).indexOf(k) >= 0;
      } catch (e) { return false; }
    }
    function bind(el) {
      if (el.__favLP || !el.querySelector) return;
      el.__favLP = true;
      var star = el.querySelector(".menu-fav");
      if (!star || !star.dataset || !star.dataset.k) return;
      var k = star.dataset.k;
      var timer = null, fired = false;
      function fire() {
        fired = true;
        favToggle(k);
        var on = favIsOn(k);
        var s = el.querySelector(".menu-fav");
        if (s) { s.textContent = on ? "\\u2605" : "\\u2606"; s.style.color = on ? "#f0a020" : "#c8cdd2"; }
        el.style.background = "rgba(240,160,32,.18)";
        setTimeout(function () { try { el.style.background = ""; } catch (e) {} }, 500);
        try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
        var label = String(el.textContent || "").replace(/[\\u2605\\u2606]/g, "").trim();
        try { toast(on ? "\\u5df2\\u52a0\\u5165\\u5feb\\u6377\\u5e38\\u7528\\uff1a" + label : "\\u5df2\\u79fb\\u51fa\\u5feb\\u6377\\u5e38\\u7528\\uff1a" + label); } catch (e) {}
      }
      function begin() { fired = false; if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = null; fire(); }, PRESS_MS); }
      function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
      el.addEventListener("touchstart", function () { suppressMouseUntil = Date.now() + 2000; begin(); }, { passive: true });
      el.addEventListener("touchend", cancel);
      el.addEventListener("touchmove", cancel);
      el.addEventListener("touchcancel", cancel);
      el.addEventListener("mousedown", function () { if (Date.now() < suppressMouseUntil) return; begin(); });
      el.addEventListener("mouseup", cancel);
      el.addEventListener("mouseleave", cancel);
      /* 长按触发后吞掉随后的 click，避免「加收藏」同时把菜单打开了 */
      el.addEventListener("click", function (ev) {
        if (fired) { fired = false; ev.stopPropagation(); ev.preventDefault(); }
      }, true);
    }
    function bindAll() {
      var mb = document.getElementById("menuBody");
      if (!mb) return;
      var items = mb.querySelectorAll(".menu-item.sub");
      for (var i = 0; i < items.length; i++) { try { bind(items[i]); } catch (e) {} }
    }
    function start() {
      var mb = document.getElementById("menuBody");
      if (!mb) { setTimeout(start, 300); return; }
      if (typeof MutationObserver !== "undefined") {
        try { new MutationObserver(function () { bindAll(); }).observe(mb, { childList: true, subtree: true }); }
        catch (e) { setInterval(bindAll, 800); }
      } else {
        setInterval(bindAll, 800);
      }
      bindAll();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  })();
''' % MARKER


def already(s):
    return MARKER in s


def patch(path):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if already(s):
        return "SKIP(already)"
    # 注入点：文件末尾 IIFE 的收尾 `})();` 之前（保证能访问 IIFE 内收藏函数）
    idx = s.rfind("})();")
    if idx < 0:
        return "FAIL(no IIFE tail)"
    new = s[:idx] + INJECT + "\n" + s[idx:]
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new)
    return "OK"


def main():
    check = "--check" in sys.argv
    for key, path in TARGETS:
        if not os.path.isfile(path):
            print("  [%s] MISSING %s" % (key, path))
            continue
        if check:
            with io.open(path, "r", encoding="utf-8") as f:
                print("  [%s] %s" % (key, "已注入" if already(f.read()) else "未注入"))
            continue
        print("  [%s] %s -> %s" % (key, os.path.basename(path), patch(path)))


if __name__ == "__main__":
    main()
