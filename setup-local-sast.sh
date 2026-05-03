#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/Front-end"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to install Bandit, Semgrep, and pre-commit."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install the frontend ESLint security plugins."
  exit 1
fi

echo "Installing Python security tools..."
python3 -m pip install --upgrade pip
python3 -m pip install pre-commit bandit semgrep

echo "Installing frontend ESLint security plugins..."
cd "${FRONTEND_DIR}"
npm install --no-save eslint-plugin-no-secrets eslint-plugin-react eslint-plugin-security

echo "Installing pre-commit hooks..."
cd "${ROOT_DIR}"
pre-commit install

echo
echo "Local SAST setup complete."
echo "Run all checks with:"
echo "  pre-commit run --all-files"
echo
echo "Security reports in CI are uploaded as artifacts from:"
echo "  - Bandit JSON"
echo "  - ESLint security JSON"
echo "  - Semgrep SARIF"
