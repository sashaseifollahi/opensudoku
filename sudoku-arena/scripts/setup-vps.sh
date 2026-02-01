#!/bin/bash
set -e

# Sudoku Arena VPS Initial Setup Script
# Run this on a fresh Ubuntu/Debian VPS

echo "=== Sudoku Arena VPS Setup ==="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo ./scripts/setup-vps.sh)"
    exit 1
fi

# Get domain name
read -p "Enter your domain name (e.g., sudoku.example.com): " DOMAIN
read -p "Enter your email for SSL certificate: " EMAIL

log_info "Updating system packages..."
apt-get update && apt-get upgrade -y

log_info "Installing required packages..."
apt-get install -y \
    curl \
    git \
    ufw \
    fail2ban \
    nginx \
    certbot \
    python3-certbot-nginx

# Setup firewall
log_info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Install Node.js
log_info "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
log_info "Installing PM2..."
npm install -g pm2

# Create app directory
APP_DIR="/var/www/sudoku-arena"
mkdir -p $APP_DIR
mkdir -p /var/log/sudoku-arena

# Clone repository
log_info "Cloning repository..."
cd $APP_DIR
if [ ! -d ".git" ]; then
    git clone https://github.com/YOUR_USERNAME/opensudoku.git .
fi
cd sudoku-arena

# Install dependencies and build
log_info "Installing dependencies..."
npm ci

log_info "Building application..."
npm run build

# Create data directory
mkdir -p data

# Setup nginx
log_info "Configuring Nginx..."
cat > /etc/nginx/sites-available/sudoku-arena << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Add rate limiting zone to nginx.conf if not exists
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;' /etc/nginx/nginx.conf
fi

# Enable site
ln -sf /etc/nginx/sites-available/sudoku-arena /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t
systemctl reload nginx

# Start application with PM2
log_info "Starting application with PM2..."
cd $APP_DIR/sudoku-arena
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup SSL with Let's Encrypt
log_info "Setting up SSL certificate..."
certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Setup automatic SSL renewal
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Setup fail2ban
log_info "Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Setup log rotation
cat > /etc/logrotate.d/sudoku-arena << EOF
/var/log/sudoku-arena/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF

echo ""
log_info "=== Setup Complete ==="
echo ""
echo "Your Sudoku Arena is now running at:"
echo "  https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart app"
echo "  systemctl status nginx - Check nginx status"
echo ""
echo "Database location: $APP_DIR/sudoku-arena/data/sudoku-arena.db"
echo ""
log_warn "Remember to:"
echo "  1. Update the REPO_URL in this script with your actual repo"
echo "  2. Configure your domain's DNS to point to this server"
echo "  3. Set up regular database backups"
