#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 WiX v7 为单个 Win11 WebView2 发布目录生成 MSI。

与旧 gen_win_msi.py 的区别：
  * 用 WiX v4+ 的 <Files Include="..."> 自动收割整棵发布树，
    不再依赖硬编码 15 条文件清单（旧清单会漏掉 webroot/images、
    webroot/leaflet/images 等资源，装完后地图图标缺失）。
  * 全流程在纯 ASCII 临时目录内执行（wix build 的 -out 不支持中文路径）。

用法：
  python3 gen_msi_v331.py --pub <发布目录> --name <产品名> --ver <版本> \
                          --upgrade <UpgradeCode> --exe <exe文件名> --out <目标msi>
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

WIX = shutil.which("wix") or os.path.expanduser("~/.dotnet/tools/wix.exe")

PRODUCT_WXS = '''<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package Name="{name}" Language="2052" Version="{ver}" Manufacturer="xiaoyi" UpgradeCode="{upgrade}" Scope="perMachine">
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed. Please uninstall it first." />
    <MediaTemplate EmbedCab="yes" />
    <Feature Id="ProductFeature" Title="Main" Level="1">
      <ComponentGroupRef Id="MainComponents" />
      <ComponentRef Id="StartMenuShortcut" />
      <ComponentRef Id="DesktopShortcut" />
    </Feature>
    <StandardDirectory Id="ProgramFiles64Folder">
      <Directory Id="INSTALLFOLDER" Name="{name}" />
    </StandardDirectory>
    <StandardDirectory Id="ProgramMenuFolder">
      <Directory Id="ApplicationProgramsFolder" Name="{name}" />
    </StandardDirectory>
    <StandardDirectory Id="DesktopFolder" />
    <Component Id="StartMenuShortcut" Guid="{guid_menu}" Directory="ApplicationProgramsFolder">
      <Shortcut Id="AppShortcut" Name="{name}" Target="[INSTALLFOLDER]{exe}" WorkingDirectory="INSTALLFOLDER" />
      <RemoveFolder Id="CleanMenuDir" Directory="ApplicationProgramsFolder" On="uninstall" />
      <RegistryValue Root="HKLM" Key="Software\\xiaoyi\\{regkey}" Name="menu" Type="integer" Value="1" KeyPath="yes" />
    </Component>
    <Component Id="DesktopShortcut" Guid="{guid_desk}" Directory="DesktopFolder">
      <Shortcut Id="AppShortcutDesk" Name="{name}" Target="[INSTALLFOLDER]{exe}" WorkingDirectory="INSTALLFOLDER" />
      <RegistryValue Root="HKLM" Key="Software\\xiaoyi\\{regkey}" Name="desktop" Type="integer" Value="1" KeyPath="yes" />
    </Component>
  </Package>
</Wix>
'''

FILES_WXS = '''<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Fragment>
    <ComponentGroup Id="MainComponents" Directory="INSTALLFOLDER">
      <Files Include="payload\\**" />
    </ComponentGroup>
  </Fragment>
</Wix>
'''


def guid_from(seed, tail):
    """由 UpgradeCode 派生稳定 GUID（同产品跨版本升级需保持不变）。"""
    core = seed.strip("{}").split("-")
    return "{%s-%s-4000-8000-%s}" % (core[0], tail, core[-1][-12:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pub", required=True, help="dotnet publish 输出目录")
    ap.add_argument("--name", required=True)
    ap.add_argument("--ver", required=True)
    ap.add_argument("--upgrade", required=True)
    ap.add_argument("--exe", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    if not os.path.isdir(a.pub):
        print("[FATAL] 发布目录不存在：%s" % a.pub)
        return 2
    if not os.path.isfile(os.path.join(a.pub, a.exe)):
        print("[FATAL] 发布目录缺少 %s" % a.exe)
        return 2

    work = tempfile.mkdtemp(prefix="msi331_", dir="C:/tmp" if os.path.isdir("C:/tmp") else None)
    try:
        payload = os.path.join(work, "payload")
        shutil.copytree(a.pub, payload,
                        ignore=shutil.ignore_patterns("*.pdb", "*.msi", "*.wxs", "*.wixpdb", "*.log"))
        n_files = sum(len(f) for _, _, f in os.walk(payload))

        # 版本号：MSI ProductVersion 只认前三段，且每段 <= 65535
        parts = [p for p in a.ver.split(".") if p.isdigit()][:3]
        while len(parts) < 3:
            parts.append("0")
        msi_ver = ".".join(str(min(int(p), 65535)) for p in parts)

        with open(os.path.join(work, "product.wxs"), "w", encoding="utf-8") as f:
            f.write(PRODUCT_WXS.format(
                name=a.name, ver=msi_ver, upgrade=a.upgrade, exe=a.exe,
                regkey="".join(ch for ch in a.exe if ch.isalnum()) or "app",
                guid_menu=guid_from(a.upgrade, "9001"),
                guid_desk=guid_from(a.upgrade, "9002"),
            ))
        with open(os.path.join(work, "files.wxs"), "w", encoding="utf-8") as f:
            f.write(FILES_WXS)

        out_en = os.path.join(work, "setup.msi")
        r = subprocess.run([WIX, "build", "product.wxs", "files.wxs", "-arch", "x64", "-out", out_en],
                           cwd=work, capture_output=True, text=True, errors="ignore")
        if not os.path.isfile(out_en):
            print("[FATAL] wix build 失败 exit=%d" % r.returncode)
            print((r.stdout or "")[-2000:])
            print((r.stderr or "")[-2000:])
            return 1

        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        shutil.copy2(out_en, a.out)
        print("✅ MSI 生成 %s  (%d bytes, 收割 %d 个文件, ProductVersion=%s)"
              % (os.path.basename(a.out), os.path.getsize(a.out), n_files, msi_ver))
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
