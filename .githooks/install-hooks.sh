#!/bin/bash
# Setup pre-commit hooks for secret detection
# Run this once after cloning or pulling the repo

echo "Installing git pre-commit hook..."

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy the pre-commit hook
cp .githooks/pre-commit .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✓ Pre-commit hook installed successfully"
echo ""
echo "The hook will now:"
echo "  • Check for hardcoded secrets before each commit"
echo "  • Prevent .env files (without .example) from being committed"
echo "  • Scan for high-entropy strings that look like API keys"
echo ""
echo "To bypass the hook (NOT RECOMMENDED):"
echo "  git commit --no-verify"
echo ""
