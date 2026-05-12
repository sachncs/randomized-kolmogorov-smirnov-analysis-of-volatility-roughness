#!/usr/bin/env sh
set -e

echo "Cleaning up project artifacts..."

# Build outputs and caches
rm -rf dist/
rm -rf .eslintcache
rm -rf .cache/
rm -rf tmp/
rm -rf temp/
rm -rf coverage/
rm -rf .nyc_output/

# Demo build outputs
rm -rf demo/dist/

# Generated experiment outputs
rm -rf data/samples/*

# npm artifacts
rm -f *.tgz

# Logs
rm -rf logs/
rm -f *.log

echo "Cleanup complete."
