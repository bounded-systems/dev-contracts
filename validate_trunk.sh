#!/bin/bash

# Exit on error
set -e

DEVTOOLS_DIR="/Users/bobby/dev/pushd-devtools"
TRUNK_YAML="$DEVTOOLS_DIR/trunk/.trunk/trunk.yaml"

echo "Validating trunk.yaml configuration..."

# Check if trunk is installed
if ! command -v trunk &>/dev/null; then
	echo "Error: trunk is not installed"
	exit 1
fi

# Check if the trunk.yaml file exists
if [ ! -f "$TRUNK_YAML" ]; then
	echo "Error: trunk.yaml not found at $TRUNK_YAML"
	exit 1
fi

# Run trunk check to validate the configuration
cd "$DEVTOOLS_DIR/trunk" && trunk check

# Validate the configuration using trunk's built-in validation
if ! trunk check --config "$TRUNK_YAML" >/dev/null 2>&1; then
	echo "Error: trunk.yaml configuration is invalid"
	exit 1
fi

echo "Validation successful!"
echo "Configuration is valid and working correctly"
