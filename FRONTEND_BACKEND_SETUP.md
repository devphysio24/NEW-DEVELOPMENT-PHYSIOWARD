# Frontend-Backend Setup Guide

## ✅ Frontend Configuration Updated

Ang frontend ay na-configure na para gamitin ang Render backend:
- **Backend URL**: `https://new-development-physioward.onrender.com`
- **Configuration File**: `frontend/src/config/api.ts`
- **Environment Variable**: `VITE_API_BASE_URL` sa `frontend/.env`

## ⚠️ Important: Backend CORS Configuration

Para mag-work ang frontend sa production, kailangan i-configure ang backend CORS sa Render.

### Sa Render Dashboard:

1. Pumunta sa backend service settings
2. I-click ang **"Environment"** tab
3. I-add o i-update ang environment variable:

```
ALLOWED_ORIGINS=https://your-frontend-url.onrender.com,https://your-custom-domain.com
```

**Halimbawa:**
- Kung ang frontend mo ay nasa Render din: `ALLOWED_ORIGINS=https://your-frontend-app.onrender.com`
- Kung may custom domain: `ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
- Para sa local development: `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174`

### Multiple Origins:
Kung may multiple frontend URLs, i-separate lang ng comma:
```
ALLOWED_ORIGINS=https://app1.onrender.com,https://app2.onrender.com,http://localhost:5173
```

## 📝 Current Configuration

### Frontend:
- **API Base URL**: `https://new-development-physioward.onrender.com`
- **Environment Variable**: `VITE_API_BASE_URL` (optional, may default na)

### Backend:
- **URL**: `https://new-development-physioward.onrender.com`
- **CORS**: Configured via `ALLOWED_ORIGINS` environment variable

## 🔄 Testing

1. **Test Backend Health:**
   ```bash
   curl https://new-development-physioward.onrender.com/health
   ```
   Dapat mag-return: `{"status":"ok","message":"Server is running"}`

2. **Test Frontend Connection:**
   - Open ang frontend app
   - Try mag-login
   - Check browser console para sa errors

3. **Check CORS Errors:**
   - Kung may CORS error sa browser console, i-check ang `ALLOWED_ORIGINS` sa Render
   - Make sure ang frontend URL ay included sa allowed origins

## 🚀 Deployment Checklist

- [x] Frontend API configuration updated
- [x] Environment variables set
- [ ] Backend CORS configured (ALLOWED_ORIGINS)
- [ ] Test backend health endpoint
- [ ] Test frontend-backend connection
- [ ] Verify authentication works
- [ ] Check all API endpoints

## 📚 Notes

- Ang frontend ay automatic na mag-use ng `VITE_API_BASE_URL` kung naka-set
- Kung walang environment variable, mag-use ng default: `https://new-development-physioward.onrender.com`
- Para sa local development, pwede mo i-override sa `.env` file:
  ```
  VITE_API_BASE_URL=http://localhost:3000
  ```

