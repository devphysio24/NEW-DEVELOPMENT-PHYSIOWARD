/**
 * Cloudflare R2 Upload Utility
 * Handles image uploads to Cloudflare R2 storage
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-05d1c2b6e97644ab85a5b81bb4be6a83.r2.dev'

// Initialize S3 client for R2
let s3Client: S3Client | null = null

export function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.error('[R2 Upload] Missing configuration:', {
        R2_ACCOUNT_ID: R2_ACCOUNT_ID ? 'SET' : 'MISSING',
        R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
        R2_BUCKET_NAME: R2_BUCKET_NAME ? 'SET' : 'MISSING',
      })
      throw new Error('R2 configuration is missing. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.')
    }

    console.log('[R2 Upload] Initializing S3 client for R2:', {
      accountId: R2_ACCOUNT_ID,
      bucketName: R2_BUCKET_NAME,
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    })

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return s3Client
}

/**
 * Upload image to Cloudflare R2
 * Security: Uses secure filename generation and proper MIME types
 * @param file - File buffer or File object
 * @param userId - User ID for unique file naming (UUID format expected)
 * @param fileExtension - File extension (validated, e.g., 'jpg', 'png')
 * @returns Public URL of uploaded image
 */
export async function uploadProfileImage(
  file: Buffer | ArrayBuffer,
  userId: string,
  fileExtension: string = 'jpg'
): Promise<string> {
  try {
    const client = getS3Client()
    
    // Security: Validate userId format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format')
    }
    
    // Security: Generate secure, unique filename
    // Format: profile-{userId}-{timestamp}-{random}.{ext}
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    const fileName = `profile-${userId}-${timestamp}-${random}.${fileExtension}`
    const key = `profiles/${fileName}`

    // Convert to Buffer if needed
    let buffer: Buffer
    if (Buffer.isBuffer(file)) {
      buffer = file
    } else {
      buffer = Buffer.from(file)
    }

    // Security: Get proper MIME type for Content-Type header
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    const contentType = mimeTypes[fileExtension] || 'image/jpeg'

    console.log('[R2 Upload] Uploading image:', {
      bucket: R2_BUCKET_NAME,
      key,
      fileSize: buffer.length,
      contentType,
    })

    // Upload to R2
    // Security: Set proper Content-Type and Cache-Control headers
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
      Metadata: {
        'uploaded-by': userId,
        'upload-timestamp': timestamp.toString(),
      }
    })

    await client.send(command)
    console.log('[R2 Upload] Image uploaded successfully to R2')

    // Return public URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[R2 Upload] Generated public URL:', publicUrl)
    }
    
    return publicUrl
  } catch (error: any) {
    console.error('[R2 Upload] Error uploading image:', error)
    console.error('[R2 Upload] Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.code,
      requestId: error.$metadata?.requestId,
      httpStatusCode: error.$metadata?.httpStatusCode,
    })
    throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Upload incident photo to Cloudflare R2
 * Security: Uses secure filename generation and proper MIME types
 * @param file - File buffer or File object
 * @param oderId - User ID who reported the incident (UUID format expected)
 * @param incidentId - Incident ID for unique file naming
 * @param fileExtension - File extension (validated, e.g., 'jpg', 'png')
 * @returns Public URL of uploaded image
 */
export async function uploadIncidentPhoto(
  file: Buffer | ArrayBuffer,
  userId: string,
  incidentId: string,
  fileExtension: string = 'jpg'
): Promise<string> {
  try {
    const client = getS3Client()
    
    // Security: Validate userId format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format')
    }
    
    // Security: Generate secure, unique filename
    // Format: incident-{oderId}-{incidentId}-{timestamp}-{random}.{ext}
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    const safeIncidentId = incidentId.replace(/[^a-z0-9-]/gi, '').substring(0, 36)
    const fileName = `incident-${userId}-${safeIncidentId}-${timestamp}-${random}.${fileExtension}`
    const key = `incidents/${fileName}`

    // Convert to Buffer if needed
    let buffer: Buffer
    if (Buffer.isBuffer(file)) {
      buffer = file
    } else {
      buffer = Buffer.from(file)
    }

    // Security: Get proper MIME type for Content-Type header
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    const contentType = mimeTypes[fileExtension] || 'image/jpeg'

    console.log('[R2 Upload] Uploading incident photo:', {
      bucket: R2_BUCKET_NAME,
      key,
      fileSize: buffer.length,
      contentType,
    })

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        'uploaded-by': userId,
        'incident-id': safeIncidentId,
        'upload-timestamp': timestamp.toString(),
      }
    })

    await client.send(command)
    console.log('[R2 Upload] Incident photo uploaded successfully to R2')

    // Return public URL - ensure R2_PUBLIC_URL is valid
    const baseUrl = R2_PUBLIC_URL || 'https://pub-05d1c2b6e97644ab85a5b81bb4be6a83.r2.dev'
    const publicUrl = `${baseUrl}/${key}`
    
    console.log('[R2 Upload] Generated incident photo URL:', {
      R2_PUBLIC_URL,
      baseUrl,
      key,
      publicUrl
    })
    
    // Validate URL before returning
    if (!publicUrl.startsWith('https://')) {
      console.error('[R2 Upload] Invalid URL generated:', publicUrl)
      throw new Error('Invalid URL generated - missing https prefix')
    }
    
    return publicUrl
  } catch (error: any) {
    console.error('[R2 Upload] Error uploading incident photo:', error)
    throw new Error(`Failed to upload incident photo: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Delete incident photo from Cloudflare R2
 * @param imageUrl - Full URL of the image to delete
 */
export async function deleteIncidentPhoto(imageUrl: string): Promise<void> {
  try {
    if (!imageUrl) {
      return
    }

    // Security: Validate that URL is from our R2 bucket
    if (!imageUrl.includes(R2_PUBLIC_URL)) {
      console.warn('[R2 Upload] URL is not from R2 bucket, skipping deletion:', imageUrl)
      return
    }

    const client = getS3Client()
    const key = imageUrl.replace(`${R2_PUBLIC_URL}/`, '')
    
    // Security: Ensure key is within incidents directory
    if (!key.startsWith('incidents/')) {
      console.error('[R2 Upload] Invalid key path (not in incidents/), skipping deletion:', key)
      return
    }

    console.log('[R2 Upload] Deleting incident photo:', key)

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await client.send(command)
    console.log('[R2 Upload] Incident photo deleted successfully:', key)
  } catch (error: any) {
    console.error('[R2 Upload] Error deleting incident photo:', error)
  }
}

/**
 * Delete image from Cloudflare R2
 * Security: Validates URL format and key path before deletion
 * @param imageUrl - Full URL of the image to delete
 */
export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    if (!imageUrl) {
      console.warn('[R2 Upload] No image URL provided for deletion')
      return
    }

    // Security: Validate that URL is from our R2 bucket
    if (!imageUrl.includes(R2_PUBLIC_URL)) {
      console.warn('[R2 Upload] URL is not from R2 bucket, skipping deletion:', imageUrl)
      return
    }

    const client = getS3Client()
    
    // Security: Extract and validate key from URL
    const key = imageUrl.replace(`${R2_PUBLIC_URL}/`, '')
    
    // Security: Ensure key is within profiles directory (prevent unauthorized deletion)
    if (!key.startsWith('profiles/')) {
      console.error('[R2 Upload] Invalid key path (not in profiles/), skipping deletion:', key)
      return
    }

    // Security: Validate key format (profile-{uuid}-{timestamp}-{random}.{ext})
    const keyPattern = /^profiles\/profile-[0-9a-f-]+-\d+-[a-z0-9]+\.(jpg|jpeg|png|gif|webp)$/i
    if (!keyPattern.test(key)) {
      console.error('[R2 Upload] Invalid key format, skipping deletion:', key)
      return
    }

    console.log('[R2 Upload] Deleting image:', key)

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await client.send(command)
    console.log('[R2 Upload] Image deleted successfully:', key)
  } catch (error: any) {
    console.error('[R2 Upload] Error deleting image:', error)
    // Don't throw - deletion failure shouldn't break the flow
  }
}

/**
 * Result type for image proxy fetch
 */
export interface ImageProxyResult {
  success: boolean
  buffer?: Buffer
  contentType?: string
  etag?: string
  error?: string
  status?: number
}

/**
 * Extract R2 key from stored URL
 * Handles both full URLs and partial paths
 * @param storedUrl - URL stored in database (may be full URL or partial)
 * @param prefix - Expected directory prefix (e.g., 'profiles', 'incidents')
 */
export function extractR2Key(storedUrl: string, prefix: string): string {
  let key = storedUrl
  
  // If it's a full URL, extract the key
  if (storedUrl.startsWith('http')) {
    key = storedUrl.replace(`${R2_PUBLIC_URL}/`, '')
  } else if (!storedUrl.startsWith(prefix)) {
    // If it's just the filename, add the prefix
    key = `${prefix}/${storedUrl}`
  }
  
  return key
}

/**
 * Generate ETag for caching
 * @param key - R2 key
 */
export function generateETag(key: string): string {
  return `"${Buffer.from(key).toString('base64')}"`
}

/**
 * Centralized image proxy function for fetching images from R2
 * Used by both profile image and incident photo endpoints
 * 
 * Security:
 * - Validates key prefix to prevent path traversal
 * - Uses proper caching headers
 * - Handles errors gracefully
 * 
 * Performance:
 * - ETag-based caching (304 responses)
 * - Immutable cache headers for long-term caching
 * - Efficient streaming to buffer conversion
 * 
 * @param key - R2 object key
 * @param allowedPrefixes - Array of allowed directory prefixes for security
 * @param ifNoneMatch - Client's ETag for cache validation
 */
export async function fetchImageFromR2(
  key: string,
  allowedPrefixes: string[],
  ifNoneMatch?: string
): Promise<ImageProxyResult> {
  try {
    // Security: Validate key prefix to prevent unauthorized access
    const isValidPrefix = allowedPrefixes.some(prefix => key.startsWith(prefix))
    if (!isValidPrefix) {
      console.error('[R2 Proxy] Invalid key prefix:', { key, allowedPrefixes })
      return { 
        success: false, 
        error: 'Invalid image path', 
        status: 403 
      }
    }

    // Security: Prevent path traversal attacks
    if (key.includes('..') || key.includes('//')) {
      console.error('[R2 Proxy] Path traversal attempt detected:', key)
      return { 
        success: false, 
        error: 'Invalid image path', 
        status: 403 
      }
    }

    // Generate ETag for caching
    const etag = generateETag(key)

    // Performance: Return 304 if client has cached version
    if (ifNoneMatch === etag) {
      return { 
        success: true, 
        etag, 
        status: 304 
      }
    }

    // Validate R2 configuration
    if (!R2_BUCKET_NAME) {
      console.error('[R2 Proxy] R2 bucket not configured')
      return { 
        success: false, 
        error: 'Storage not configured', 
        status: 500 
      }
    }

    // Fetch from R2
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = getS3Client()
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    const response = await client.send(command)
    
    if (!response.Body) {
      return { 
        success: false, 
        error: 'Image not found', 
        status: 404 
      }
    }

    // Convert stream to buffer efficiently
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // Determine content type
    const contentType = response.ContentType || 'image/jpeg'

    return {
      success: true,
      buffer,
      contentType,
      etag,
      status: 200
    }
  } catch (error: any) {
    // Handle specific S3 errors
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      return { 
        success: false, 
        error: 'Image not found', 
        status: 404 
      }
    }
    
    console.error('[R2 Proxy] Error fetching image:', {
      key,
      error: error.message,
      code: error.Code || error.code
    })
    
    return { 
      success: false, 
      error: 'Failed to fetch image', 
      status: 500 
    }
  }
}

/**
 * Create HTTP Response for image proxy
 * Centralized response creation with proper headers
 * 
 * @param result - Result from fetchImageFromR2
 */
export function createImageProxyResponse(result: ImageProxyResult): Response {
  // Handle 304 Not Modified
  if (result.status === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': result.etag!,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // Handle errors
  if (!result.success || !result.buffer) {
    return new Response(
      JSON.stringify({ error: result.error || 'Unknown error' }),
      {
        status: result.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Return image with optimized caching headers
  return new Response(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': result.contentType!,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': result.etag!,
      'Vary': 'Accept-Encoding',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

