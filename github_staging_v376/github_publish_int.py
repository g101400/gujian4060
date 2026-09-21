#!/usr/bin/env python3
# 三图一张图 v3.76/1.52/3.7.13 GitHub 内部 Release 发布（Python 驱动，避免 shell glob）
import subprocess, sys, os

GH = r"C:/Program Files/GitHub CLI/gh.exe"
STAGE = r"D:/Users/Claw/github_staging_v376"
ARCHS = ["amd64", "arm64", "loongarch64", "mips64el"]


def run(cmd):
    print(">>> " + " ".join(cmd), flush=True)
    r = subprocess.run(cmd)
    return r.returncode


def publish_release(repo, tag, title, notes, *files):
    print(f"==> [release] {repo} @ {tag}", flush=True)
    for f in files:
        if not os.path.exists(f):
            print(f"   ❌ 缺失资产: {f}", flush=True)
            sys.exit(2)
    check = subprocess.run([GH, "release", "view", tag, "--repo", repo],
                           capture_output=True, text=True)
    if check.returncode == 0:
        print("   已存在 release，跳过创建", flush=True)
        return
    cmd = [GH, "release", "create", tag, "--repo", repo,
           "--title", title, "--notes-file", notes, "--latest", *files]
    rc = run(cmd)
    print(f"   rc={rc}", flush=True)
    if rc != 0:
        sys.exit(rc)


# 鉴权
if run([GH, "auth", "status"]) != 0:
    print("❌ 未登录 GitHub", flush=True)
    sys.exit(1)

# 水利 shuili
debs_sh = [f"{STAGE}/shuili-yitu5090/uos/shuili-map_3.76.20260916_{a}.deb" for a in ARCHS]
publish_release("g101400/shuili-yitu5090", "v3.76", "水利工程一张图 v3.76",
               f"{STAGE}/RELEASE_NOTES.md",
               f"{STAGE}/shuili-yitu5090/android/水利工程一张图V3.76_20260916.apk",
               *debs_sh,
               f"{STAGE}/shuili-yitu5090/ios/水利工程一张图_iOS_3.76_20260916_可托管.zip")

# 感知 ganzhi
debs_gz = [f"{STAGE}/ganzhi-yitu5090/uos/shuili-ganzhi_1.52.20260916_{a}.deb" for a in ARCHS]
publish_release("g101400/ganzhi-yitu5090", "v1.52", "水利感知项目一张图 v1.52",
               f"{STAGE}/RELEASE_NOTES.md",
               f"{STAGE}/ganzhi-yitu5090/android/水利感知项目一张图V1.52_20260916.apk",
               *debs_gz,
               f"{STAGE}/ganzhi-yitu5090/ios/水利感知项目一张图_iOS_1.52_20260916_可托管.zip")

# 古建 gujian
debs_gj = [f"{STAGE}/gujian-travel5090/uos/gujian-map_3.7.13.20260916_{a}.deb" for a in ARCHS]
publish_release("g101400/gujian-travel5090", "v3.7.13", "古建景点打卡 v3.7.13",
               f"{STAGE}/RELEASE_NOTES.md",
               f"{STAGE}/gujian-travel5090/android/古建景点打卡V3.7.13_20260916.apk",
               *debs_gj,
               f"{STAGE}/gujian-travel5090/ios/古建景点打卡_iOS_3.7.13_20260916_可托管.zip")

print("✅ 内部 Release 全部发布完成", flush=True)
