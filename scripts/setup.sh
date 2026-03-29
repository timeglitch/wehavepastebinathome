#!/bin/bash
set -euo pipefail

# Install Node.js 22
dnf install -y nodejs npm nginx

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /opt/pastebin
chown ec2-user:ec2-user /opt/pastebin

# Configure nginx as reverse proxy
cat > /etc/nginx/conf.d/pastebin.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Remove default nginx config
rm -f /etc/nginx/conf.d/default.conf

# Enable and start nginx
systemctl enable nginx
systemctl start nginx

# Configure PM2 to start on boot (as ec2-user)
su - ec2-user -c "pm2 startup systemd -u ec2-user --hp /home/ec2-user" | tail -1 | bash
