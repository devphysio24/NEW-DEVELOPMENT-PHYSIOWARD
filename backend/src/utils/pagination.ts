/**
 * Pagination Utilities
 * Supports both offset-based and cursor-based pagination
 * Cursor-based is more efficient for large datasets
 */

export interface PaginationParams {
  limit: number
  cursor?: string // Base64 encoded cursor
  page?: number // For offset-based pagination
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    limit: number
    hasNext: boolean
    hasPrev: boolean
    nextCursor?: string
    prevCursor?: string
    // For offset-based (backward compatibility)
    page?: number
    total?: number
    totalPages?: number
  }
}

export interface Cursor {
  id: string
  createdAt: string | Date
  [key: string]: any // Additional sort fields
}

/**
 * Encode cursor to base64 string
 */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

/**
 * Decode cursor from base64 string
 */
export function decodeCursor(encoded: string): Cursor | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Error decoding cursor:', error)
    return null
  }
}

/**
 * Parse pagination parameters from query
 */
export function parsePaginationParams(c: any): {
  limit: number
  cursor?: string
  page?: number
  useCursor: boolean
} {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100) // Max 100
  const cursor = c.req.query('cursor')
  const page = c.req.query('page') ? parseInt(c.req.query('page')!) : undefined

  // Default to cursor-based if no page specified, or if cursor is provided
  const useCursor = cursor !== undefined || page === undefined

  return {
    limit,
    cursor: cursor || undefined,
    page,
    useCursor,
  }
}

/**
 * Create pagination result for cursor-based pagination
 */
export function createCursorPaginationResult<T>(
  data: T[],
  limit: number,
  cursor?: string,
  getCursor?: (item: T) => Cursor
): PaginationResult<T> {
  const hasNext = data.length > limit
  const hasPrev = !!cursor

  // Remove extra item if we got one (used to check if there's a next page)
  if (hasNext) {
    data = data.slice(0, limit)
  }

  // Generate next cursor from last item
  let nextCursor: string | undefined
  if (hasNext && data.length > 0 && getCursor) {
    const lastItem = data[data.length - 1]
    nextCursor = encodeCursor(getCursor(lastItem))
  }

  // Generate prev cursor from first item
  let prevCursor: string | undefined
  if (hasPrev && data.length > 0 && getCursor) {
    const firstItem = data[0]
    prevCursor = encodeCursor(getCursor(firstItem))
  }

  return {
    data,
    pagination: {
      limit,
      hasNext,
      hasPrev,
      nextCursor,
      prevCursor,
    },
  }
}

/**
 * Create pagination result for offset-based pagination (backward compatible)
 */
export function createOffsetPaginationResult<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit)

  return {
    data,
    pagination: {
      limit,
      page,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

/**
 * Generate Supabase query for cursor-based pagination
 * Returns the query builder with cursor applied
 */
export function applyCursorPagination<T>(
  query: any,
  cursor: string | undefined,
  sortField: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): any {
  if (!cursor) {
    // No cursor, start from beginning
    return query.order(sortField, { ascending: sortOrder === 'asc' })
  }

  const decoded = decodeCursor(cursor)
  if (!decoded) {
    // Invalid cursor, start from beginning
    return query.order(sortField, { ascending: sortOrder === 'asc' })
  }

  // Apply cursor filter
  if (sortOrder === 'desc') {
    return query
      .order(sortField, { ascending: false })
      .lt(sortField, decoded[sortField] || decoded.createdAt)
  } else {
    return query
      .order(sortField, { ascending: true })
      .gt(sortField, decoded[sortField] || decoded.createdAt)
  }
}

/**
 * Get cursor from item (default implementation)
 */
export function getDefaultCursor<T extends { id?: string; created_at?: string | Date }>(item: T): Cursor {
  return {
    id: item.id || '',
    createdAt: item.created_at || new Date().toISOString(),
  }
}










