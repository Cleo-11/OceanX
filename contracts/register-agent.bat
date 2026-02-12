@echo off
REM Windows batch script to register UpgradeManager as transferAgent
REM Make sure you have set up your .env file first!

echo ========================================
echo  Register UpgradeManager as Transfer Agent
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.register-agent to .env and fill in your values.
    pause
    exit /b 1
)

echo Loading environment from .env...
echo.

REM Execute the Foundry script
forge script script/RegisterTransferAgent.s.sol:RegisterTransferAgent ^
    --rpc-url %RPC_URL% ^
    --broadcast ^
    --legacy

if %errorlevel% neq 0 (
    echo.
    echo ❌ Registration failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ Registration successful!
echo.
echo Next step: Verify the registration with verify-agent.bat
pause
