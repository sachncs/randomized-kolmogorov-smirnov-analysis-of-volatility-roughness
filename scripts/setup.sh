#!/usr/bin/env sh
set -e

echo "Setting up rksavr..."

# Check Node.js version
node_version=$(node -v | sed 's/v//')
required_version="18.0.0"

if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "Error: Node.js >= 18.x is required (found $node_version)"
    exit 1
fi

echo "Node.js version: $node_version"

# Install dependencies
if [ -f package-lock.json ]; then
    echo "Installing dependencies from package-lock.json..."
    npm ci
else
    echo "Installing dependencies..."
    npm install
fi

# Run initial build
echo "Building distribution files..."
npm run build

# Run lint to verify setup
echo "Running linter..."
npm run lint

# Run tests
echo "Running tests..."
npm test

echo "Setup complete. You can now run 'npm run dev' to start the demo."
