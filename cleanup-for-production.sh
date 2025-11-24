#!/bin/bash
# Production Cleanup Script
# Run this to organize files before deploying to production

echo "🧹 Cleaning up project structure for production..."

# Create archive directory for documentation
mkdir -p docs/archive
mkdir -p docs/audits
mkdir -p docs/implementation-notes

# Move audit reports
echo "📁 Moving audit reports..."
mv AUDIT-VERIFICATION-REPORT.md docs/audits/ 2>/dev/null
mv FRESH-PRODUCTION-AUDIT-2025.md docs/audits/ 2>/dev/null
mv PRODUCTION-AUDIT-REPORT-UPDATED.md docs/audits/ 2>/dev/null
mv PRODUCTION-READINESS-AUDIT.md docs/audits/ 2>/dev/null

# Move implementation documentation
echo "📁 Moving implementation docs..."
mv CLAIM-VALIDATION-IMPLEMENTATION.md docs/implementation-notes/ 2>/dev/null
mv CRITICAL-SECURITY-FIXES-SUMMARY.md docs/implementation-notes/ 2>/dev/null
mv CRITICAL-SECURITY-NONCE-VALIDATION.md docs/implementation-notes/ 2>/dev/null
mv MIGRATION-GUIDE.md docs/implementation-notes/ 2>/dev/null
mv MINING-IMPLEMENTATION-COMPLETE.md docs/implementation-notes/ 2>/dev/null
mv MINING-QUICK-REFERENCE.md docs/implementation-notes/ 2>/dev/null
mv MINING-SYSTEM-DOCUMENTATION.md docs/implementation-notes/ 2>/dev/null
mv MINING-VERIFICATION-CHECKLIST.md docs/implementation-notes/ 2>/dev/null
mv NONCE-TEST-RESULTS.md docs/implementation-notes/ 2>/dev/null
mv NONCE-VALIDATION-IMPLEMENTED.md docs/implementation-notes/ 2>/dev/null
mv POSITION-FIX-SUMMARY.md docs/implementation-notes/ 2>/dev/null
mv POSITION-VALIDATION-FIX.md docs/implementation-notes/ 2>/dev/null
mv SECURITY-ARCHITECTURE-CORRECTION.md docs/implementation-notes/ 2>/dev/null
mv SECURITY-ENHANCEMENTS-SUMMARY.md docs/implementation-notes/ 2>/dev/null
mv SECURITY-FIXES.md docs/implementation-notes/ 2>/dev/null

# Move test files
echo "📁 Moving test files..."
mkdir -p tests/manual
mkdir -p tests/output

mv test-claim-validation.js tests/manual/ 2>/dev/null
mv test-claim-validation.sh tests/manual/ 2>/dev/null
mv test-output.txt tests/output/ 2>/dev/null
mv test-results.txt tests/output/ 2>/dev/null
mv full-test-output.txt tests/output/ 2>/dev/null
mv jest-output.txt tests/output/ 2>/dev/null

# Move server test files
echo "📁 Moving server test files..."
mkdir -p server/__tests__
mv server/test-signature.js server/__tests__/ 2>/dev/null
mv server/test-claim-service.js server/__tests__/ 2>/dev/null
mv server/test-claim-flow.js server/__tests__/ 2>/dev/null
mv server/check-*.js server/__tests__/ 2>/dev/null
mv server/debug-signature.js server/__tests__/ 2>/dev/null

# Move utility scripts
echo "📁 Moving utility scripts..."
mv check-backend-health.sh scripts/ 2>/dev/null
mv check-demo-ready.sh scripts/ 2>/dev/null
mv check-production-ready.sh scripts/ 2>/dev/null
mv fix-css.sh scripts/ 2>/dev/null

# Remove log files (they'll be regenerated)
echo "🗑️  Removing log files..."
rm -f server/server-startup.log 2>/dev/null
rm -f server/server.log 2>/dev/null

# Update .gitignore to exclude logs
echo "📝 Updating .gitignore..."
if ! grep -q "*.log" .gitignore; then
  echo "" >> .gitignore
  echo "# Log files" >> .gitignore
  echo "*.log" >> .gitignore
  echo "server/*.log" >> .gitignore
fi

# Create organized README structure
echo "📝 Creating README index..."
cat > docs/README.md << 'EOF'
# OceanX Documentation

## 📚 Documentation Structure

### Audits
Security and production readiness audits:
- See `audits/` folder for all audit reports

### Implementation Notes
Detailed implementation documentation:
- See `implementation-notes/` folder for feature documentation

### Database
Database schema and migrations:
- See `../db/` folder

### Smart Contracts
Blockchain contracts and ABIs:
- See `../contracts/` folder

### Scripts
Utility and deployment scripts:
- See `../scripts/` folder

## 🚀 Quick Links
- [Security Enhancements](./SECURITY-ENHANCEMENTS.md)
- [Mining Race Condition Fix](./MINING-RACE-CONDITION-FIX.md)
- [Production Audit Checklist](./SECURITY-AUDIT-CHECKLIST.md)
EOF

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   - Moved audit reports to docs/audits/"
echo "   - Moved implementation notes to docs/implementation-notes/"
echo "   - Moved test files to tests/"
echo "   - Moved server tests to server/__tests__/"
echo "   - Moved scripts to scripts/"
echo "   - Removed log files"
echo "   - Updated .gitignore"
echo ""
echo "🔍 Run 'git status' to see the changes"
echo "💡 Commit with: git add . && git commit -m 'chore: organize project structure for production'"
