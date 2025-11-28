# Cloudflare R2 Public URL Setup Guide

## Problem
Ang error `ERR_NAME_NOT_RESOLVED` ay nangangahulugan na hindi naka-configure ang public access sa Cloudflare R2.

## Solution: Enable Public Access sa Cloudflare R2

### Step 1: Pumunta sa Cloudflare R2 Dashboard
1. Login sa [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Pumunta sa **R2** section
3. Piliin ang bucket: **physioward**

### Step 2: Enable Public Access
1. Click sa **Settings** tab ng bucket
2. Scroll down sa **Public Access** section
3. I-click ang **"Allow Access"** o **"Enable Public Access"** button
4. I-save ang changes

### Step 3: Get the Public URL
Pagkatapos i-enable ang public access, makikita mo ang public URL. Maaaring:

**Option A: Automatic Public URL**
- Format: `https://pub-{random-id}.r2.dev`
- Example: `https://pub-abc123xyz.r2.dev`
- Copy ang URL na ito

**Option B: Custom Domain** (kung may custom domain ka)
- Format: `https://your-custom-domain.com`
- Example: `https://cdn.yourdomain.com`
- Copy ang URL na ito

### Step 4: Update .env File
I-update ang `R2_PUBLIC_URL` sa `backend/.env`:

```env
R2_PUBLIC_URL=https://pub-abc123xyz.r2.dev
```

O kung may custom domain:
```env
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

### Step 5: Restart Backend Server
```bash
# Stop current server (Ctrl+C)
cd backend
npm run dev
```

### Step 6: Test
1. Upload ulit ang profile image
2. I-check kung naglo-load na ang image
3. I-verify sa browser console na walang `ERR_NAME_NOT_RESOLVED` error

## Alternative: Use Custom Domain

Kung gusto mong gumamit ng custom domain:

1. Sa R2 bucket settings, pumunta sa **Custom Domains** section
2. I-add ang custom domain mo
3. I-configure ang DNS records (CNAME) sa Cloudflare DNS
4. I-update ang `R2_PUBLIC_URL` sa `.env` para gamitin ang custom domain

## Troubleshooting

### Kung hindi pa rin nag-work:
1. **I-verify ang public URL**: I-test ang URL directly sa browser
2. **I-check ang DNS**: Siguraduhing naka-resolve ang domain
3. **I-clear browser cache**: Hard refresh (Ctrl+Shift+R)
4. **I-check ang R2 bucket permissions**: Dapat naka-enable ang public read access

### Common Issues:
- **Public access not enabled**: I-enable sa R2 dashboard
- **Wrong URL format**: I-copy ang exact URL mula sa R2 settings
- **DNS not propagated**: Maghintay ng ilang minuto pagkatapos i-enable

