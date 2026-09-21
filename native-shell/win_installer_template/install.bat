@echo off
chcp 65001 >nul
setlocal
set APPNAME=__APPNAME__
set EXE=__EXE__
set SRC=%~dp0
set DEST=%ProgramFiles%\%APPNAME%

echo ==========================================
echo   %APPNAME% 安装
echo ==========================================
echo.
if not exist "%DEST%" mkdir "%DEST%"
echo 复制程序到 %DEST% ...
xcopy "%SRC%*.*" "%DEST%\" /E /Y /Q >nul
echo 创建开始菜单快捷方式 ...
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([Environment]::GetFolderPath('StartMenu')+'\Programs\%APPNAME%.lnk'); $s.TargetPath='%DEST%\%EXE%'; $s.WorkingDirectory='%DEST%'; $s.Save()"
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\ %APPNAME%.lnk'); $s.TargetPath='%DEST%\%EXE%'; $s.WorkingDirectory='%DEST%'; $s.Save()"
echo.
echo 安装完成。开始菜单 / 桌面已生成「%APPNAME%」快捷方式。
echo 卸载请运行 %DEST%\uninstall.bat
pause
endlocal
