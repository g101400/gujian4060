$ErrorActionPreference = "Continue"
$env:PATH += ";C:\Users\admin\.dotnet\tools"
$base = "D:\Users\Claw\APK归档\四端安装包_20260824"
$logf = "C:\tmp_msi_build.log"
Start-Transcript -Path $logf -Force

$projects = @(
  @{dir="win-水利-水利工程一张图";      name="水利工程基础信息一张图"; ver="3.30.1"; upg="{A1B2C3D4-0001-4000-8000-000000000001}"; exe="水利工程基础信息一张图.exe"},
  @{dir="win-感知-水利感知项目一张图";  name="水利感知项目一张图";     ver="1.6.1";  upg="{B2C3D4E5-0002-4000-8000-000000000002}"; exe="水利感知项目一张图.exe"},
  @{dir="win-古建-古建景点打卡";        name="古建景点打卡";           ver="1.8.1";  upg="{C3D4E5F6-0003-4000-8000-000000000003}"; exe="古建景点打卡.exe"}
)

# 通用文件清单（相对发布目录）
$fileRows = @(
  @{src=$null; id="F_exe";    cid="C_exe";    guid="{D1A2B3C4-1001-4000-8000-000000000001}"},
  @{src="WebView2Loader.dll"; id="F_loader"; cid="C_loader"; guid="{D1A2B3C4-1002-4000-8000-000000000002}"},
  @{src="Microsoft.Web.WebView2.Core.xml";   id="F_xml1"; cid="C_xml1"; guid="{D1A2B3C4-1003-4000-8000-000000000003}"},
  @{src="Microsoft.Web.WebView2.WinForms.xml"; id="F_xml2"; cid="C_xml2"; guid="{D1A2B3C4-1004-4000-8000-000000000004}"},
  @{src="Microsoft.Web.WebView2.Wpf.xml"; id="F_xml3"; cid="C_xml3"; guid="{D1A2B3C4-1005-4000-8000-000000000005}"},
  @{src="runtimes/win-x64/native/WebView2Loader.dll"; id="F_rloader"; cid="C_rloader"; guid="{D1A2B3C4-1006-4000-8000-000000000006}"; short="RVIEW2LD.DLL"},
  @{src="webroot/app.js";       id="F_appjs";  cid="C_appjs";  guid="{D1A2B3C4-1007-4000-8000-000000000007}"},
  @{src="webroot/data.js";      id="F_datajs"; cid="C_datajs"; guid="{D1A2B3C4-1008-4000-8000-000000000008}"},
  @{src="webroot/index.html";   id="F_index";  cid="C_index";  guid="{D1A2B3C4-1009-4000-8000-000000000009}"},
  @{src="webroot/jszip.min.js"; id="F_jszip";  cid="C_jszip";  guid="{D1A2B3C4-1010-4000-8000-000000000010}"},
  @{src="webroot/version.json"; id="F_ver";    cid="C_ver";    guid="{D1A2B3C4-1011-4000-8000-000000000011}"},
  @{src="webroot/leaflet/leaflet.css";         id="F_lcss";  cid="C_lcss";  guid="{D1A2B3C4-1012-4000-8000-000000000012}"},
  @{src="webroot/leaflet/leaflet.js";          id="F_ljs";   cid="C_ljs";   guid="{D1A2B3C4-1013-4000-8000-000000000013}"},
  @{src="webroot/leaflet/leaflet/leaflet.css"; id="F_lcss2"; cid="C_lcss2"; guid="{D1A2B3C4-1014-4000-8000-000000000014}"},
  @{src="webroot/leaflet/leaflet/leaflet.js";  id="F_ljs2";  cid="C_ljs2";  guid="{D1A2B3C4-1015-4000-8000-000000000015}"}
)

foreach ($p in $projects) {
  $srcdir = Join-Path $base $p.dir
  Write-Host "=== $($p.name) ==="
  # 清理旧的 msi/wxs/log
  Get-ChildItem $srcdir -Filter "*_Setup.msi" | Remove-Item -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $srcdir "files.wxs"), (Join-Path $srcdir "product.wxs") -ErrorAction SilentlyContinue

  # 动态填充 exe 源文件名
  foreach ($fr in $fileRows) { if ($fr.src -eq $null) { $fr.src = $p.exe } }

  # files.wxs
  $fl = @('<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">', '  <Fragment>', '    <ComponentGroup Id="MainComponents" Directory="INSTALLFOLDER">')
  foreach ($fr in $fileRows) {
    $sn = if ($fr.short) { ' ShortName="{0}"' -f $fr.short } else { '' }
    $fl += '      <Component Id="{0}" Guid="{1}">' -f $fr.cid, $fr.guid
    $fl += '        <File Id="{0}" Source="{1}"{2} KeyPath="yes" />' -f $fr.id, $fr.src, $sn
    $fl += '      </Component>'
  }
  $fl += @('    </ComponentGroup>', '  </Fragment>', '</Wix>')
  Set-Content -Path (Join-Path $srcdir "files.wxs") -Value $fl -Encoding UTF8

  # product.wxs (用单引号避免 \ 转义问题)
  $prod = '<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">' + "`n" +
    '  <Package Name="' + $p.name + '" Language="2052" Version="' + $p.ver + '" Manufacturer="小七" UpgradeCode="' + $p.upg + '">' + "`n" +
    '    <MajorUpgrade DowngradeErrorMessage="已安装更高版本，请先卸载。" />' + "`n" +
    '    <MediaTemplate EmbedCab="yes" />' + "`n" +
    '    <Feature Id="ProductFeature" Title="主程序" Level="1">' + "`n" +
    '      <ComponentGroupRef Id="MainComponents" />' + "`n" +
    '      <ComponentRef Id="StartMenuShortcut" />' + "`n" +
    '    </Feature>' + "`n" +
    '    <StandardDirectory Id="ProgramFiles64Folder">' + "`n" +
    '      <Directory Id="INSTALLFOLDER" Name="' + $p.name + '" />' + "`n" +
    '    </StandardDirectory>' + "`n" +
    '    <StandardDirectory Id="ProgramMenuFolder">' + "`n" +
    '      <Directory Id="ApplicationProgramsFolder" Name="' + $p.name + '" />' + "`n" +
    '    </StandardDirectory>' + "`n" +
    '    <Component Id="StartMenuShortcut" Guid="{A1B2C3D4-0002-4000-8000-000000000002}" Directory="ApplicationProgramsFolder">' + "`n" +
    '      <Shortcut Id="AppShortcut" Name="' + $p.name + '" Target="[INSTALLFOLDER]' + $p.exe + '" WorkingDirectory="INSTALLFOLDER" />' + "`n" +
    '      <RemoveFolder Id="CleanMenuDir" Directory="ApplicationProgramsFolder" On="uninstall" />' + "`n" +
    '      <RegistryValue Root="HKCU" Key="Software\小七\' + $p.name + '" Name="installed" Type="integer" Value="1" KeyPath="yes" />' + "`n" +
    '    </Component>' + "`n" +
    '  </Package>' + "`n" +
    '</Wix>'
  Set-Content -Path (Join-Path $srcdir "product.wxs") -Value $prod -Encoding UTF8

  # 验证 wxs 已写
  Write-Host "    files.wxs: $(Test-Path (Join-Path $srcdir 'files.wxs')), product.wxs: $(Test-Path (Join-Path $srcdir 'product.wxs'))"

  # build
  $out = Join-Path $srcdir "$($p.name)_Setup.msi"
  Set-Location $srcdir
  & wix build product.wxs files.wxs -out $out
  $ec = $LASTEXITCODE
  if (Test-Path $out) {
    Write-Host "    ✅ $($p.name)_Setup.msi 生成, $((Get-Item $out).Length) bytes (exit=$ec)"
  } else {
    Write-Host "    ❌ 失败 exit=$ec"
  }
  # 清理中间 wxs
  Remove-Item (Join-Path $srcdir "files.wxs"), (Join-Path $srcdir "product.wxs") -ErrorAction SilentlyContinue
}
Stop-Transcript
Write-Host "DONE"
