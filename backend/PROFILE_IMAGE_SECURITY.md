# Profile Image Upload - Security & Architecture

## Overview
Secure profile image upload system using Cloudflare R2 storage with comprehensive validation, proper error handling, and OWASP compliance.

## Security Features

### 1. Input Validation (OWASP A03:2021 - Injection)
- **Whitelist approach**: Only allowed MIME types and extensions
- **Double validation**: Both MIME type and file extension checked
- **Size limits**: Maximum 5MB to prevent DoS attacks
- **Filename sanitization**: Prevents directory traversal attacks

### 2. Authentication & Authorization (OWASP A01:2021)
- **Authentication required**: `authMiddleware` enforces user authentication
- **User ownership**: Users can only modify their own profile images
- **No privilege escalation**: UUID validation prevents unauthorized access

### 3. Secure File Storage
- **Unique filenames**: `profile-{uuid}-{timestamp}-{random}.{ext}`
- **Path restriction**: Images stored only in `profiles/` directory
- **Metadata tracking**: Upload timestamp and user ID stored
- **Automatic cleanup**: Old images deleted before new upload

### 4. Data Protection (OWASP A02:2021)
- **Proper Content-Type**: MIME type validation and header setting
- **Cache control**: Immutable caching with 1-year expiry
- **HTTPS only**: All image URLs use HTTPS
- **No sensitive data**: Filenames don't contain PII

### 5. Error Handling (OWASP A04:2021)
- **Detailed logging**: All errors logged with context
- **Generic error messages**: No sensitive info exposed to client
- **Graceful degradation**: Failed operations don't crash system
- **Transaction rollback**: Failed DB updates trigger image deletion

## Architecture

### Flow Diagram
```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Upload Image
       ▼
┌─────────────────────────────────┐
│  Frontend Validation            │
│  - File type check              │
│  - Size check (5MB max)         │
│  - Extension validation         │
└──────┬──────────────────────────┘
       │ 2. POST /api/auth/profile/image
       ▼
┌─────────────────────────────────┐
│  Backend Auth Middleware        │
│  - Verify JWT token             │
│  - Extract user ID              │
└──────┬──────────────────────────┘
       │ 3. Authenticated
       ▼
┌─────────────────────────────────┐
│  Backend Validation             │
│  - File type whitelist          │
│  - Extension validation         │
│  - Size limit check             │
│  - Filename sanitization        │
└──────┬──────────────────────────┘
       │ 4. Valid
       ▼
┌─────────────────────────────────┐
│  Delete Old Image               │
│  - Fetch current profile_image  │
│  - Validate key path            │
│  - Delete from R2               │
└──────┬──────────────────────────┘
       │ 5. Upload New Image
       ▼
┌─────────────────────────────────┐
│  Cloudflare R2 Upload           │
│  - Generate secure filename     │
│  - Set proper headers           │
│  - Store metadata               │
└──────┬──────────────────────────┘
       │ 6. Update Database
       ▼
┌─────────────────────────────────┐
│  Supabase Database Update       │
│  - Update profile_image_url     │
│  - Rollback on failure          │
└──────┬──────────────────────────┘
       │ 7. Return Success
       ▼
┌─────────────────────────────────┐
│  Client Updates UI              │
│  - Refresh auth context         │
│  - Reload page (cache bust)     │
└─────────────────────────────────┘
```

## File Structure

### Backend
```
backend/src/
├── routes/
│   └── auth.ts              # Profile image endpoints
├── utils/
│   ├── imageValidation.ts   # Centralized validation logic
│   ├── r2Upload.ts          # R2 storage operations
│   └── adminClient.ts       # Supabase admin client
└── middleware/
    └── auth.ts              # Authentication middleware
```

### Frontend
```
frontend/src/
├── pages/dashboard/profile/
│   ├── Profile.tsx          # Profile page with upload UI
│   └── Profile.css          # Styling
├── utils/
│   └── imageUtils.ts        # Image URL utilities
├── components/
│   ├── TopNavbar.tsx        # Shows profile image
│   └── Sidebar.tsx          # Shows profile image
└── contexts/
    └── AuthContext.tsx      # Auth state management
```

## API Endpoints

### POST /api/auth/profile/image
Upload a new profile image.

**Authentication**: Required (JWT)

**Request**:
- Content-Type: `multipart/form-data`
- Body: `image` (File, max 5MB)

**Response**:
```json
{
  "message": "Profile image uploaded successfully",
  "profile_image_url": "https://..."
}
```

**Errors**:
- 400: Invalid file type/size/format
- 401: Unauthorized
- 500: Server error

### DELETE /api/auth/profile/image
Delete the current profile image.

**Authentication**: Required (JWT)

**Response**:
```json
{
  "message": "Profile image deleted successfully"
}
```

**Errors**:
- 400: No profile image to delete
- 401: Unauthorized
- 404: User not found
- 500: Server error

### GET /api/auth/profile/image/:userId
Proxy endpoint for serving images (used when DNS not propagated).

**Authentication**: Not required (public endpoint)

**Response**: Image binary data with proper Content-Type

## Environment Variables

### Required
```env
# R2 Storage Configuration
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=physioward
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

## Validation Rules

### File Type
- **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- **Allowed extensions**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **Validation**: Both MIME type AND extension must match

### File Size
- **Maximum**: 5MB (5,242,880 bytes)
- **Minimum**: > 0 bytes (no empty files)

### Filename
- **Pattern**: `profile-{uuid}-{timestamp}-{random}.{ext}`
- **Sanitization**: Special characters replaced with underscore
- **Max length**: 255 characters

### Storage Path
- **Directory**: `profiles/` only
- **Validation**: Regex pattern enforced
- **Prevention**: Directory traversal attacks blocked

## Performance Optimizations

### Caching Strategy
1. **R2 Cache**: 1-year immutable cache (`Cache-Control` header)
2. **Client Cache Busting**: Timestamp query parameter (`?t=timestamp`)
3. **Proxy Endpoint**: Serves images through backend during DNS propagation

### Image Optimization
1. **Compression**: Client-side validation encourages smaller files
2. **Format Support**: Modern formats (WebP) supported
3. **CDN Ready**: Can be moved to CDN with minimal changes

## Error Handling

### Backend Errors
- **Validation errors**: 400 status with descriptive message
- **Auth errors**: 401 status
- **Server errors**: 500 status with generic message (no stack traces to client)
- **Logging**: All errors logged with full context for debugging

### Frontend Errors
- **Network errors**: Retry logic via apiClient
- **Validation errors**: Immediate feedback before upload
- **Upload errors**: Clear error messages shown to user
- **Fallback UI**: Shows initials if image fails to load

## Testing Checklist

### Security Tests
- [ ] Upload non-image file (should fail)
- [ ] Upload oversized file (should fail)
- [ ] Upload with invalid extension (should fail)
- [ ] Upload without authentication (should fail 401)
- [ ] Upload for another user (should fail)
- [ ] Path traversal attempt (should fail)

### Functional Tests
- [ ] Upload new image (should succeed)
- [ ] Replace existing image (old should delete)
- [ ] Delete image (should succeed)
- [ ] View image in navbar (should show)
- [ ] View image in sidebar (should show)
- [ ] View image in profile page (should show)
- [ ] Logout and login (image should persist)

### Performance Tests
- [ ] Upload 5MB image (should succeed within 10s)
- [ ] Sequential uploads (no leaks)
- [ ] Cache effectiveness (no unnecessary refetches)
- [ ] Page reload speed (cached images)

## Maintenance

### Cleanup Strategy
- **Automatic**: Old images deleted on new upload
- **Manual**: Orphaned images can be cleaned via script
- **Monitoring**: Track storage usage and costs

### Logging
- **Upload success**: Info level with URL
- **Upload failure**: Error level with details
- **Delete success**: Info level with key
- **Delete failure**: Warning level (non-blocking)

## Future Enhancements

### Potential Improvements
1. **Image Processing**: Resize/compress server-side
2. **CDN Integration**: Use CloudFlare CDN for faster delivery
3. **Custom Domain**: Replace r2.dev with branded domain
4. **WebP Conversion**: Auto-convert to WebP for better compression
5. **Progressive Upload**: Show preview while uploading
6. **Batch Operations**: Allow multiple image uploads
7. **Image Cropping**: Client-side crop before upload

### Monitoring
1. **Storage Metrics**: Track R2 usage and costs
2. **Upload Metrics**: Success/failure rates
3. **Performance Metrics**: Upload latency
4. **Error Tracking**: Aggregate error patterns

---

**Last Updated**: 2024
**Maintained By**: Backend Team
**Security Review Date**: 2024

