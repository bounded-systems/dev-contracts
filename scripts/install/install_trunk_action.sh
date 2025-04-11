#!/usr/bin/env sh
# Install script for trunk-actions plugin

# Expects the action name (e.g., trunk-check-pre-commit) as $1
# and the version (e.g., enabled) as $2
ACTION_NAME="$1"
REQUESTED_VERSION="$2"

# We only care if the requested version is 'enabled'
if [ "$REQUESTED_VERSION" = "enabled" ]; then
  # Here you could potentially add logic based on ACTION_NAME if needed in the future
  echo "Install script for trunk-actions: Acknowledging request for action '$ACTION_NAME' to be '$REQUESTED_VERSION'. No specific installation action needed."
  exit 0
else
  # Log unexpected calls but still exit successfully
  echo "Install script for trunk-actions: Called with unexpected action/version '$ACTION_NAME' '$REQUESTED_VERSION'. Exiting successfully."
  exit 0
fi
