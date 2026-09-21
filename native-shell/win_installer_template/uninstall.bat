@echo off
chcp 65001 >nul
setlocal
set APPNAME=__APPNAME__
set DEST=%ProgramFiles%\%APPNAME%

echo ==========================================
echo   %APPNAME% 卸载
echo ==========================================
echo.
echo 删除开始菜单 / 桌面快捷方式 ...
del /Q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\%APPNAME%.lnk" 2>nul
powershell -NoProfile -Command "Remove-Item ([Environment]::GetFolderPath('StartMenu')+'\Programs\%APPNAME%.lnk') -Force -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "Remove-Item ([Environment]::GetFolderPath('Desktop')+'\ %APPNAME%.lnk') -Force -ErrorAction SilentlyContinue"
echo 删除安装目录 %DEST% ...
rmdir /S /Q "%DEST%" 2>nul
echo.
echo 卸载完成。
pause
endlocal
