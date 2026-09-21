#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_smart_further_query.py — 三图家族三端「智能查询后续操作」(用户需求第七)

查询命中多个结果后，自动给出按维度细化的「进一步查询」建议 chips：
  - 维度来自命中结果自身的分类字段（water: office/station/btype/attrs；gujian: province/city/type/dynasty/level/attrs），通用三端；
  - 单击 chip = 复制「原关键词 + 维度值」组合查询串到剪贴板；
  - 双击 chip = 把组合查询串回填查询框并立即进一步查询。
建议框自愈合地挂在顶部搜索框容器下（queryFurther 不存在则动态创建），不依赖各端筛选面板结构差异。
注入方式：纯 Python 字符串替换，每处均 assert old 存在。
"""
import io, os, sys

WEBROOTS = [
    "android-build/shuili-v329/assets/app.js",
    "android-build/water-v329/assets/app.js",
    "native-shell/win-water-webview2/webroot/app.js",
    "native-shell/uos-water-pyqt6/webroot/app.js",
    "aowwei_app/webroot_shuili/app.js",
    "android-build/perc-v13/assets/app.js",
    "native-shell/win-webview2/webroot/app.js",
    "native-shell/uos-pyqt6/webroot/app.js",
    "travel/android/assets/app.js",
    "native-shell/win-gujian-webview2/webroot/app.js",
    "native-shell/uos-gujian-pyqt6/webroot/app.js",
]

CSS = (
    ".qf-box{margin-top:8px}"
    ".qf-hint{font-size:12px;color:#888;margin:4px 0 6px;line-height:1.5}"
    ".qf-chips{display:flex;flex-wrap:wrap;gap:6px}"
    ".qf-chip{cursor:pointer;user-select:none;padding:5px 10px;border:1px solid var(--border,rgba(0,0,0,.15));"
    "border-radius:14px;background:rgba(33,150,243,.08);font-size:13px;transition:background .15s}"
    ".qf-chip:hover{background:rgba(33,150,243,.18)}"
    ".qf-chip .n{color:#1976d2;font-weight:600;margin-left:4px}"
    ".qf-dim{opacity:.7;margin-right:2px}"
)
CSS_INJECT = (
    "\n  /* v3.48 智能查询后续操作：样式运行时注入（幂等） */"
    "\n  (function () {"
    "\n    if (document.getElementById(\"qf-style\")) return;"
    "\n    var s = document.createElement(\"style\"); s.id = \"qf-style\";"
    "\n    s.textContent = " + repr(CSS) + ";"
    "\n    (document.head || document.documentElement).appendChild(s);"
    "\n  })();"
)
HELPERS = (
    "\n  /* ---------- v3.48 智能查询后续操作 ---------- */"
    "\n  window.furtherQuery = function (q) {"
    "\n    filters.text = (q || \"\").trim();"
    "\n    var sb = $(\"search\"); if (sb) sb.value = filters.text;"
    "\n    var ft = $(\"filterText\"); if (ft) ft.value = filters.text;"
    "\n    saveDefaultFilter();"
    "\n    if (typeof window.doQueryConfirm === \"function\") window.doQueryConfirm();"
    "\n    else if (typeof window.applyFilterAndJump === \"function\") window.applyFilterAndJump();"
    "\n  };"
    "\n  function copyText(t) {"
    "\n    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}"
    "\n    try { var ta = document.createElement(\"textarea\"); ta.value = t; ta.style.position = \"fixed\"; ta.style.opacity = \"0\";"
    "\n      document.body.appendChild(ta); ta.focus(); ta.select(); var ok = document.execCommand(\"copy\"); document.body.removeChild(ta); return ok; } catch (e) { return false; }"
    "\n  }"
    "\n  function renderQueryFurther(matched, kw) {"
    "\n    var box = $(\"queryFurther\");"
    "\n    if (!box) {"
    "\n      var holder = $(\"search\");"
    "\n      if (!holder || !holder.parentNode) return;"
    "\n      box = document.createElement(\"div\"); box.id = \"queryFurther\"; box.className = \"qf-box\";"
    "\n      holder.parentNode.insertBefore(box, holder.nextSibling);"
    "\n    }"
    "\n    box.innerHTML = \"\";"
    "\n    if (!matched || !matched.length) return;"
    "\n    var dims = {};"
    "\n    function bump(dim, val) { if (!val) return; val = String(val); if (kw && val.indexOf(kw) >= 0) return; var k = dim + \"\\u0001\" + val; if (!dims[k]) dims[k] = { dim: dim, val: val, n: 0 }; dims[k].n++; }"
    "\n    matched.forEach(function (b) {"
    "\n      bump(\"管理单位\", b.office); bump(\"管理站\", b.station); bump(\"类型\", b.btype);"
    "\n      bump(\"省份\", b.province); bump(\"城市\", b.city); bump(\"类别\", b.type); bump(\"年代\", b.dynasty); bump(\"级别\", b.level);"
    "\n      (b.attrs || []).forEach(function (a) { if (a && a[0]) bump(a[0], a[1]); });"
    "\n    });"
    "\n    var arr = Object.keys(dims).map(function (k) { return dims[k]; }).filter(function (d) { return d.n >= 2; });"
    "\n    arr.sort(function (a, b) { return b.n - a.n; });"
    "\n    if (arr.length > 8) arr = arr.slice(0, 8);"
    "\n    if (!arr.length) return;"
    "\n    var hint = document.createElement(\"div\"); hint.className = \"qf-hint\";"
    "\n    hint.innerHTML = \"💡 进一步查询（智能推荐）：<b>单击</b>复制组合关键词，<b>双击</b>直接进一步查询。\";"
    "\n    box.appendChild(hint);"
    "\n    var wrap = document.createElement(\"div\"); wrap.className = \"qf-chips\";"
    "\n    arr.forEach(function (d) {"
    "\n      var q = (kw ? kw + \" \" : \"\") + d.val;"
    "\n      var c = document.createElement(\"span\"); c.className = \"qf-chip\";"
    "\n      c.innerHTML = '<span class=\"qf-dim\">' + esc(d.dim) + \"</span>\" + esc(d.val) + '<span class=\"n\">' + d.n + \"</span>\";"
    "\n      c.title = \"单击复制查询「\" + q + \"」；双击直接进一步查询\";"
    "\n      c.addEventListener(\"click\", function () { copyText(q); toast(\"已复制查询关键词：「\" + q + \"」（粘贴到查询框按确定即可查询）\"); });"
    "\n      c.addEventListener(\"dblclick\", function (e) { e.preventDefault(); window.furtherQuery(q); });"
    "\n      wrap.appendChild(c);"
    "\n    });"
    "\n    box.appendChild(wrap);"
    "\n  }"
)

# doQueryConfirm 末尾锚定 toast 行 + 其后首个 "  };"
DOQC_TOAST = 'toast("查询命中 " + matched.length + " 个建筑，已用绿色虚线圈选（" + cond + "）");'
DOQC_INSERT = '    renderQueryFurther(matched, kw);  // v3.48：命中多结果时给出进一步查询建议\n'

# gujian applyFilterAndJump 末尾
GUJIAN_TAIL_OLD = (
    '    if (matched.length === 1) { appFly(matched[0].id); toast("已定位唯一匹配项"); }\n'
    '    else { appFly(matched[0].id); toast("找到 " + matched.length + " 个匹配，已跳到第一个"); }\n'
    "  };"
)
GUJIAN_TAIL_NEW = (
    '    if (matched.length === 1) { appFly(matched[0].id); toast("已定位唯一匹配项"); }\n'
    "    else { appFly(matched[0].id); toast(\"找到 \" + matched.length + \" 个匹配，已跳到第一个\"); }\n"
    '    renderQueryFurther(matched, filters.text);  // v3.48：命中多结果时给出进一步查询建议\n'
    "  };"
)


def patch_file(p):
    t = io.open(p, encoding="utf-8").read()
    if "renderQueryFurther(matched, kw);  // v3.48" in t or "renderQueryFurther(matched, filters.text);  // v3.48" in t:
        print("  SKIP(已注入) " + p); return "skip"
    has_doqc = "window.doQueryConfirm = function () {" in t
    has_guji = "window.applyFilterAndJump = function () {" in t
    assert has_doqc or has_guji, "既无 doQueryConfirm 也无 applyFilterAndJump: " + p
    # 注入 helpers + CSS：锚定本端查询函数（doQueryConfirm 优先，否则 applyFilterAndJump）
    anchor = "  window.doQueryConfirm = function () {" if has_doqc else "  window.applyFilterAndJump = function () {"
    assert anchor in t, "锚点缺失: " + p
    t = t.replace(anchor, HELPERS + CSS_INJECT + "\n" + anchor, 1)
    if has_doqc:
        ti = t.find(DOQC_TOAST); assert ti >= 0, "doQueryConfirm toast 缺失: " + p
        ej = t.find("  };", ti); assert ej >= 0, "doQueryConfirm 结束符缺失: " + p
        t = t[:ej] + DOQC_INSERT + t[ej:]
    else:  # 仅 gujian 走此分支
        gi = t.find('toast("已定位唯一匹配项")')
        assert gi >= 0, "applyFilterAndJump 定位行缺失: " + p
        gj = t.find("  };", gi)
        assert gj >= 0, "applyFilterAndJump 结束符缺失: " + p
        t = t[:gj] + '    renderQueryFurther(matched, filters.text);  // v3.48：命中多结果时给出进一步查询建议\n' + t[gj:]
    io.open(p, "w", encoding="utf-8").write(t)
    return "patched"


if __name__ == "__main__":
    ok = skip = miss = 0
    for w in WEBROOTS:
        if not os.path.exists(w):
            print("  MISS " + w); miss += 1; continue
        r = patch_file(w)
        if r == "patched": ok += 1
        elif r == "skip": skip += 1
    print("完成: patched=%d skip=%d miss=%d" % (ok, skip, miss))
    sys.exit(0 if miss == 0 else 2)
