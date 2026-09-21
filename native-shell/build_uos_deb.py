#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_uos_deb.py - 统信 UOS PyQt6 原生壳 DEB 打包（纯 Python，无需 dpkg-deb）
适配龙芯 3A4000 / 内核 4.19 统信 1050：GNU_FORMAT（无 PAX 头）+ 显式目录条目。
用法:
  python3 build_uos_deb.py --src <shell目录> --appname <显示名> --pkg <包名> \
      --version <x.y.日期> --out <输出.deb>
shell 目录需含 main.py + webroot/。
"""
import argparse, io, os, tarfile, time, shutil, tempfile

def build_ar(files, out_path):
    with open(out_path, 'wb') as f:
        f.write(b'!<arch>\n')
        for name, data in files:
            header = f'{name:<16}'.encode()
            header += b'0'.ljust(12)
            header += b'0'.ljust(6)
            header += b'0'.ljust(6)
            header += b'100644'.ljust(8)  # 必须含 100 前缀；b'0'.ljust(8)='0       ' 会让 deepin myml/ar.octal 对 b[3:1] panic
            header += str(len(data)).encode().ljust(10)
            header += b'`\n'
            f.write(header)
            f.write(data)
            if len(data) % 2 == 1:
                f.write(b'\n')

def make_control_tgz(version, pkg, appname, arch):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:xz', format=tarfile.GNU_FORMAT) as tar:
        control = f"""Package: {pkg}
Version: {version}
Section: utils
Priority: optional
Architecture: {arch}
Depends: python3
Maintainer: 小七 <xiaoyi@example.com>
Description: {appname}（统信 UOS 原生壳）
 PyQt6 + QWebEngineView 承载网页，取代 :7205 python http.server，无后台服务残留。
""".encode('utf-8')
        ti = tarfile.TarInfo('control')
        ti.size = len(control)
        ti.mode = 0o644
        tar.addfile(ti, io.BytesIO(control))
    return buf.getvalue()

def make_data_tgz(shell_dir, pkg, appname):
    opt = os.path.join('/opt', pkg)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:xz', format=tarfile.GNU_FORMAT) as tar:
        def add_dir(arcdir):
            ti = tarfile.TarInfo(arcdir)
            ti.type = tarfile.DIRTYPE
            ti.mode = 0o755
            ti.size = 0
            ti.mtime = time.time()
            tar.addfile(ti)
        # 1) 目录条目（父在前）
        dirs_seen = set(); all_dirs = []
        for root, dirs, files in os.walk(shell_dir):
            for d in dirs:
                rel = os.path.relpath(os.path.join(root, d), shell_dir).replace(os.sep, '/')
                arc = './opt/' + pkg + '/' + rel
                if arc not in dirs_seen:
                    dirs_seen.add(arc); all_dirs.append(arc)
        all_dirs.sort(key=lambda x: x.count('/'))
        add_dir('./opt/'); add_dir('./opt/' + pkg + '/')
        for arc in all_dirs: add_dir(arc)
        # 2) 文件条目
        for root, dirs, files in os.walk(shell_dir):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, shell_dir).replace(os.sep, '/')
                arcname = './opt/' + pkg + '/' + rel
                data = open(full, 'rb').read()
                ti = tarfile.TarInfo(arcname)
                ti.mode = 0o755 if fn in ('main.py',) else 0o644
                ti.size = len(data); ti.mtime = time.time()
                tar.addfile(ti, io.BytesIO(data))
    return buf.getvalue()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--appname', required=True)
    ap.add_argument('--pkg', required=True)
    ap.add_argument('--version', required=True)
    ap.add_argument('--arch', default='mips64el',
                    help='目标架构：mips64el(龙芯3A3000/3A4000) / loongarch64(3A5000+) / arm64(飞腾/鲲鹏) / amd64')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    staging = os.path.join(tempfile.gettempdir(), 'uos-deb-stage')
    if os.path.isdir(staging): shutil.rmtree(staging)
    os.makedirs(staging, exist_ok=True)
    # 拷贝 shell 目录（main.py + webroot）
    for item in os.listdir(a.src):
        s = os.path.join(a.src, item); d = os.path.join(staging, item)
        if os.path.isdir(s): shutil.copytree(s, d, dirs_exist_ok=True)
        else: shutil.copy2(s, d)

    # 启动器 /usr/bin/<pkg>
    launcher = os.path.join(staging, '_launcher.sh')
    with open(launcher, 'w', encoding='utf-8') as f:
        f.write(f'#!/bin/bash\nexec python3 /opt/{a.pkg}/main.py "$@"\n')
    os.chmod(launcher, 0o755)

    # desktop
    desktop = os.path.join(staging, '_app.desktop')
    with open(desktop, 'w', encoding='utf-8') as f:
        f.write(f"""[Desktop Entry]
Name={a.appname}
Comment={a.appname}（原生壳）
Exec={a.pkg}
Terminal=false
Type=Application
Icon=webview
Categories=Utility;Science;
""")

    # 组装 data.tar.gz：shell + launcher + desktop
    opt_pkg = os.path.join(staging, '_opt_pkg')
    os.makedirs(opt_pkg, exist_ok=True)
    for item in os.listdir(a.src):
        s = os.path.join(a.src, item); d = os.path.join(opt_pkg, item)
        if os.path.isdir(s): shutil.copytree(s, d, dirs_exist_ok=True)
        else: shutil.copy2(s, d)

    build_dir = os.path.join(staging, '_build')
    os.makedirs(os.path.join(build_dir, 'opt', a.pkg), exist_ok=True)
    os.makedirs(os.path.join(build_dir, 'usr', 'bin'), exist_ok=True)
    os.makedirs(os.path.join(build_dir, 'usr', 'share', 'applications'), exist_ok=True)
    os.makedirs(os.path.join(build_dir, 'DEBIAN'), exist_ok=True)

    data_tgz = make_data_tgz(opt_pkg, a.pkg, a.appname)
    # 把 launcher / desktop 加进 data.tar.gz（单独追加，因上面的 make_data_tgz 只打 opt）
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:xz', format=tarfile.GNU_FORMAT) as tar:
        # 重新打包：opt + usr/bin + usr/share/applications
        # 先写目录
        for d in ['./opt/', './opt/'+a.pkg+'/', './usr/', './usr/bin/', './usr/share/',
                  './usr/share/applications/', './DEBIAN/']:
            ti = tarfile.TarInfo(d); ti.type = tarfile.DIRTYPE; ti.mode = 0o755
            ti.size = 0; ti.mtime = time.time(); tar.addfile(ti)
        # opt/pkg 全量
        for root, dirs, files in os.walk(opt_pkg):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, opt_pkg).replace(os.sep, '/')
                data = open(full, 'rb').read()
                ti = tarfile.TarInfo('./opt/'+a.pkg+'/'+rel)
                ti.mode = 0o755 if fn == 'main.py' else 0o644
                ti.size = len(data); ti.mtime = time.time(); tar.addfile(ti, io.BytesIO(data))
        # launcher -> /usr/bin/<pkg>
        ldata = open(launcher, 'rb').read()
        ti = tarfile.TarInfo('./usr/bin/'+a.pkg); ti.mode = 0o755
        ti.size = len(ldata); ti.mtime = time.time(); tar.addfile(ti, io.BytesIO(ldata))
        # desktop
        ddata = open(desktop, 'rb').read()
        ti = tarfile.TarInfo('./usr/share/applications/'+a.pkg+'.desktop'); ti.mode = 0o644
        ti.size = len(ddata); ti.mtime = time.time(); tar.addfile(ti, io.BytesIO(ddata))

    build_ar([
        ('debian-binary', b'2.0\n'),
        ('control.tar.xz', make_control_tgz(a.version, a.pkg, a.appname, a.arch)),
        ('data.tar.xz', buf.getvalue()),
    ], a.out)
    print('DEB built:', a.out, os.path.getsize(a.out), 'bytes')

if __name__ == '__main__':
    main()
