@echo off
REM Windows script to verify UpgradeManager is registered as transferAgent

echo ========================================
echo  Verify Transfer Agent Registration
echo ========================================
echo.

if not exist .env (
    echo ERROR: .env file not found!
    pause
    exit /b 1
)

echo Checking if UpgradeManager is registered as transferAgent...
echo.

REM Call the transferAgents mapping on OCXToken
cast call %OCX_TOKEN_ADDRESS% ^
    "transferAgents(address)(bool)" ^
    %UPGRADE_MANAGER_ADDRESS% ^
    --rpc-url %RPC_URL%

if %errorlevel% neq 0 (
    echo.
    echo ❌ Verification failed!
    pause
    exit /b %errorlevel%
)

echo.
echo If the result is "true", registration was successful!
echo If the result is "false", you need to run register-agent.bat first.
pause
