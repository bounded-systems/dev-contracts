#!/bin/bash

# Exit on error
set -e

DEVTOOLS_DIR="/Users/bobby/dev/pushd-devtools"

# Create necessary directories if they don't exist
mkdir -p "$DEVTOOLS_DIR/runtimes/ruby"
mkdir -p "$DEVTOOLS_DIR/runtimes/node"

# Setup Ruby
echo "Setting up Ruby 3.2.2..."
if ! command -v asdf &>/dev/null; then
	echo "Installing asdf..."
	brew install asdf
fi

# Install Ruby plugin if not already installed
asdf plugin add ruby || true

# Install Ruby 3.2.2 if not already installed
asdf install ruby 3.2.2
asdf local ruby 3.2.2

# Create a basic Gemfile if it doesn't exist
if [ ! -f "$DEVTOOLS_DIR/runtimes/ruby/Gemfile" ]; then
	cat <<EOF >"$DEVTOOLS_DIR/runtimes/ruby/Gemfile"
source 'https://rubygems.org'

ruby '3.2.2'

# Add your gems here
EOF
fi

# Setup Node.js
echo "Setting up Node.js 20.11.1..."
# Install Node.js plugin if not already installed
asdf plugin add nodejs || true

# Install Node.js 20.11.1
asdf install nodejs 20.11.1
asdf local nodejs 20.11.1

# Create a basic package.json if it doesn't exist
if [ ! -f "$DEVTOOLS_DIR/runtimes/node/package.json" ]; then
	cat <<EOF >"$DEVTOOLS_DIR/runtimes/node/package.json"
{
  "name": "pushd-devtools",
  "version": "1.0.0",
  "description": "Pushd Development Tools",
  "engines": {
    "node": "20.11.1"
  }
}
EOF
fi

# Create a .env file for the devtools directory
cat <<EOF >"$DEVTOOLS_DIR/.env"
export BUNDLE_GEMFILE="$DEVTOOLS_DIR/runtimes/ruby/Gemfile"
export NODE_ENV=development
export PACKAGE_FILE="$DEVTOOLS_DIR/runtimes/node/package.json"
EOF

echo "Setup complete! Please run 'source $DEVTOOLS_DIR/.env' to load the environment variables."
echo "Ruby and Node.js environments are now set up in $DEVTOOLS_DIR"
