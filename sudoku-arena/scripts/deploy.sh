#!/bin/bash
set -e

# Sudoku Arena VPS Deployment Script
# Usage: ./scripts/deploy.sh [docker|pm2]

DEPLOY_TYPE=${1:-docker}
APP_DIR="/var/www/sudoku-arena"
REPO_URL="https://github.com/YOUR_USERNAME/opensudoku.git"

echo "=== Sudoku Arena Deployment ==="
echo "Deploy type: $DEPLOY_TYPE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo ./scripts/deploy.sh)"
    exit 1
fi

case $DEPLOY_TYPE in
    docker)
        log_info "Deploying with Docker..."

        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            log_info "Installing Docker..."
            curl -fsSL https://get.docker.com | sh
            systemctl enable docker
            systemctl start docker
        fi

        # Check if docker-compose is installed
        if ! command -v docker-compose &> /dev/null; then
            log_info "Installing Docker Compose..."
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi

        # Create app directory
        mkdir -p $APP_DIR
        cd $APP_DIR

        # Clone or update repo
        if [ -d ".git" ]; then
            log_info "Updating repository..."
            git pull origin main
        else
            log_info "Cloning repository..."
            git clone $REPO_URL .
        fi

        cd sudoku-arena

        # Build and start containers
        log_info "Building Docker image..."
        docker-compose build

        log_info "Starting containers..."
        docker-compose up -d

        log_info "Docker deployment complete!"
        docker-compose ps
        ;;

    pm2)
        log_info "Deploying with PM2..."

        # Check if Node.js is installed
        if ! command -v node &> /dev/null; then
            log_info "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi

        # Check if PM2 is installed
        if ! command -v pm2 &> /dev/null; then
            log_info "Installing PM2..."
            npm install -g pm2
        fi

        # Create app directory
        mkdir -p $APP_DIR
        mkdir -p /var/log/sudoku-arena
        cd $APP_DIR

        # Clone or update repo
        if [ -d ".git" ]; then
            log_info "Updating repository..."
            git pull origin main
        else
            log_info "Cloning repository..."
            git clone $REPO_URL .
        fi

        cd sudoku-arena

        # Install dependencies
        log_info "Installing dependencies..."
        npm ci --production=false

        # Build application
        log_info "Building application..."
        npm run build

        # Create data directory
        mkdir -p data

        # Start/Restart with PM2
        log_info "Starting with PM2..."
        pm2 delete sudoku-arena 2>/dev/null || true
        pm2 start ecosystem.config.js
        pm2 save

        # Setup PM2 startup script
        pm2 startup systemd -u root --hp /root

        log_info "PM2 deployment complete!"
        pm2 status
        ;;

    *)
        log_error "Unknown deploy type: $DEPLOY_TYPE"
        echo "Usage: ./scripts/deploy.sh [docker|pm2]"
        exit 1
        ;;
esac

echo ""
log_info "Deployment finished!"
echo "Your app should be running at http://$(hostname -I | awk '{print $1}'):3000"
