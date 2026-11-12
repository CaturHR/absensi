@echo off
title Hubungkan Mobile via USB (ADB Reverse)
color 0A
echo ========================================================
echo        PENGHUBUNG SERVER BACKEND KE HP VIA USB
echo ========================================================
echo.
echo Mencari perangkat Android yang terhubung...

set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

if not exist "%ADB_PATH%" (
    where adb >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "ADB_PATH=adb"
    ) else (
        echo [ERROR] adb.exe tidak ditemukan di Android SDK.
        echo Silakan gunakan koneksi Wi-Fi: http://192.168.1.52:5000
        goto end
    )
)

"%ADB_PATH%" devices
echo.
echo Mengaktifkan port reverse 5000 (Forward USB)...
"%ADB_PATH%" reverse tcp:5000 tcp:5000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [BERHASIL] Port 5000 berhasil di-forward ke HP!
    echo.
    echo HP Android Anda kini dapat terhubung ke:
    echo   http://127.0.0.1:5000  atau  http://localhost:5000
    echo ========================================================
) else (
    echo.
    echo [PERHATIAN] Gagal menjalankan adb reverse.
    echo Pastikan HP terhubung via kabel USB dan USB Debugging aktif.
    echo Atau gunakan koneksi Wi-Fi: http://192.168.1.52:5000
)

:end
echo.
pause

