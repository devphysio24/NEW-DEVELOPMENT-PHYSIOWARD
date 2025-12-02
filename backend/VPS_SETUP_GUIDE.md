# VPS Setup Guide - WorkReadines Backend

Complete guide para sa pag-setup ng backend sa Hostinger VPS.

## 📋 Prerequisites

- Hostinger VPS na may Ubuntu 22.04 LTS
- Domain name (optional, pwede din IP address lang)
- SSH access sa VPS

---

## 🔧 Step 1: Initial Server Setup

### 1.1 Connect sa VPS via SSH

```bash
ssh root@YOUR_VPS_IP
# or
ssh root@your-domain.com
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
```

### 1.3 Create Non-Root User (Recommended)

```bash
# Create user
adduser workreadines
usermod -aG sudo workreadines

# Switch to new user
su - workreadines
```

---

## 📦 Step 2: Install Required Software

### 2.1 Install Node.js 20.x

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version
```

### 2.2 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the command it outputs (usually: sudo env PATH=... pm2 startup systemd -u workreadines --hp /home/workreadines)
```

### 2.3 Install Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 2.4 Install Git

```bash
sudo apt install -y git
```

### 2.5 Install UFW (Firewall)

```bash
sudo apt install -y ufw

# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📁 Step 3: Setup Backend Application

### 3.1 Create Application Directory

```bash
# Create directory
mkdir -p ~/apps/workreadines-backend
cd ~/apps/workreadines-backend
```

### 3.2 Clone Repository (or upload files)

**Option A: Git Clone**
```bash
git clone YOUR_REPO_URL .
```

**Option B: Upload via SCP**
```bash
# From your local machine
scp -r backend/* workreadines@YOUR_VPS_IP:~/apps/workreadines-backend/
```

### 3.3 Install Dependencies

```bash
cd ~/apps/workreadines-backend
npm install --production
```

### 3.4 Create .env File

```bash
# Copy example file
cp .env.example .env

# Edit .env file
nano .env
```

**Required Environment Variables:**
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS (add your frontend domain)
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# Cloudflare R2 Configuration (if using)
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=your_r2_public_url

# OpenAI API Key (if using)
OPENAI_API_KEY=your_openai_api_key
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

---

## 🚀 Step 4: Build and Deploy

### 4.1 Build TypeScript

```bash
npm run build
```

### 4.2 Make deploy script executable

```bash
chmod +x deploy.sh
```

### 4.3 Run Deployment Script

```bash
./deploy.sh
```

**Or manually:**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
```

### 4.4 Verify PM2 is Running

```bash
pm2 status
pm2 logs workreadines-backend
```

---

## 🌐 Step 5: Configure Nginx

### 5.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/workreadines-backend
```

**Copy content from `nginx.conf.template` and update:**
- Replace `YOUR_DOMAIN_OR_IP` with your actual domain or IP
- Replace port `3000` if you changed it

### 5.2 Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/workreadines-backend /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5.3 Test Backend

```bash
# Test locally
curl http://localhost:3000/health

# Test via Nginx
curl http://YOUR_DOMAIN_OR_IP/health
```

---

## 🔒 Step 6: Setup SSL (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**Follow prompts:**
- Enter email
- Agree to terms
- Choose redirect HTTP to HTTPS (recommended)

### 6.3 Auto-Renewal

Certbot automatically sets up renewal. Test it:
```bash
sudo certbot renew --dry-run
```

---

## ✅ Step 7: Verify Everything Works

### 7.1 Check PM2

```bash
pm2 status
pm2 monit  # Monitor resources
```

### 7.2 Check Nginx

```bash
sudo systemctl status nginx
```

### 7.3 Test API Endpoints

```bash
# Health check
curl https://your-domain.com/health

# API test
curl https://your-domain.com/api
```

---

## 🔄 Step 8: Update Deployment Process

Para sa future updates:

```bash
cd ~/apps/workreadines-backend

# Pull latest changes (if using git)
git pull origin main

# Or upload new files via SCP

# Run deployment script
./deploy.sh
```

---

## 📊 Useful Commands

### PM2 Commands
```bash
pm2 status                          # Check status
pm2 logs workreadines-backend       # View logs
pm2 logs workreadines-backend --lines 100  # Last 100 lines
pm2 monit                           # Monitor resources
pm2 restart workreadines-backend    # Restart app
pm2 stop workreadines-backend       # Stop app
pm2 delete workreadines-backend     # Remove from PM2
pm2 save                            # Save current process list
```

### Nginx Commands
```bash
sudo nginx -t                       # Test configuration
sudo systemctl reload nginx         # Reload configuration
sudo systemctl restart nginx        # Restart Nginx
sudo systemctl status nginx         # Check status
```

### System Commands
```bash
# View logs
sudo tail -f /var/log/nginx/workreadines-backend-access.log
sudo tail -f /var/log/nginx/workreadines-backend-error.log
tail -f ~/apps/workreadines-backend/logs/pm2-combined.log

# Check disk space
df -h

# Check memory
free -h

# Check CPU
top
htop  # If installed
```

---

## 🐛 Troubleshooting

### Backend not starting
```bash
# Check PM2 logs
pm2 logs workreadines-backend --err

# Check if port is in use
sudo lsof -i :3000

# Check .env file
cat .env
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs workreadines-backend

# Test backend directly
curl http://localhost:3000/health
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R workreadines:workreadines ~/apps/workreadines-backend

# Fix permissions
chmod +x deploy.sh
```

---

## 🔐 Security Checklist

- [ ] Firewall (UFW) enabled
- [ ] Non-root user created
- [ ] SSH key authentication (disable password auth)
- [ ] SSL certificate installed
- [ ] Environment variables secured
- [ ] Regular system updates scheduled
- [ ] PM2 logs rotated
- [ ] Nginx security headers configured

---

## 📝 Notes

- Backend runs on port 3000 (internal)
- Nginx proxies to port 3000
- PM2 automatically restarts on crash
- PM2 starts on server reboot
- Logs are in `~/apps/workreadines-backend/logs/`

---

## 🆘 Support

Kung may problema:
1. Check PM2 logs: `pm2 logs workreadines-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/workreadines-backend-error.log`
3. Check system logs: `journalctl -xe`

