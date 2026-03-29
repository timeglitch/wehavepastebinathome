#!/bin/bash
set -euo pipefail

# Usage: ./scripts/deploy.sh <ip> <key>
# Example: ./scripts/deploy.sh 1.2.3.4 ~/.ssh/my-key.pem

IP="${1:?Usage: deploy.sh <ip> <key-file>}"
KEY="${2:?Usage: deploy.sh <ip> <key-file>}"
REMOTE="ec2-user@$IP"
APP_DIR="/opt/pastebin"

echo "Deploying to $IP..."

# Sync files (exclude dev artifacts and the local DB)
rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude 'pastes.db' \
  --exclude 'terraform/' \
  --exclude 'scripts/' \
  --exclude '.git/' \
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  ./ "$REMOTE:$APP_DIR/"

# Install dependencies and restart
ssh -i "$KEY" "$REMOTE" "
  cd $APP_DIR
  npm install --omit=dev
  pm2 restart pastebin 2>/dev/null || pm2 start server.js --name pastebin
  pm2 save
"

echo "Done. Visit http://$IP"
