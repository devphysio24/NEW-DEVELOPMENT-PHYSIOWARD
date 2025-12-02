# Quick Start - VPS Deployment

## 🚀 Fast Setup (After VPS is Ready)

### 1. Connect to VPS
```bash
ssh workreadines@YOUR_VPS_IP
```

### 2. Navigate to App Directory
```bash
cd ~/apps/workreadines-backend
```

### 3. Setup Environment
```bash
# Copy and edit .env
cp .env.example .env
nano .env  # Add your credentials
```

### 4. Deploy
```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 5. Verify
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs workreadines-backend

# Test API
curl http://localhost:3000/health
```

## ✅ Done!

Your backend should now be running on port 3000.

**Next Steps:**
- Configure Nginx (see `VPS_SETUP_GUIDE.md`)
- Setup SSL certificate
- Configure domain

## 📝 Common Commands

```bash
# View logs
pm2 logs workreadines-backend

# Restart
pm2 restart workreadines-backend

# Stop
pm2 stop workreadines-backend

# Monitor
pm2 monit
```

