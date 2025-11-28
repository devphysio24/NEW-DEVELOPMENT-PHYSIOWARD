# Migration Example: ClinicianDashboard

## Example: Migrating API Calls to Use Centralized Services

### Before (Old Pattern)

```typescript
// ❌ Old way - direct fetch calls
const [casesRes, plansRes] = await Promise.all([
  fetch(`${API_BASE_URL}/api/clinician/cases?status=all&limit=100`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController.signal,
  }).catch(err => {
    if (err.name === 'AbortError' || abortController.signal.aborted) {
      throw err
    }
    if (err.message?.includes('Failed to fetch')) {
      throw new Error('Backend server is not running.')
    }
    throw new Error('Network error: Failed to connect to server')
  }),
  fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans?status=active`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController.signal,
  }),
])

// Manual JSON parsing
const casesText = await casesRes.text()
if (!casesRes.ok) {
  const errorData = JSON.parse(casesText)
  throw new Error(errorData.error || 'Failed to fetch cases')
}
const casesData = JSON.parse(casesText)
```

### After (New Pattern)

```typescript
// ✅ New way - using centralized services
import { clinicianService, isApiError, getApiErrorMessage } from '../../../services'

// Create abort controller for cancellation
const abortController = new AbortController()

try {
  // Parallel requests using services
  const [casesResult, plansResult] = await Promise.all([
    clinicianService.getCases({ 
      status: 'all', 
      limit: 100 
    }),
    clinicianService.getRehabilitationPlans({ 
      status: 'active' 
    }),
  ])

  // Handle errors consistently
  if (isApiError(casesResult)) {
    setError(getApiErrorMessage(casesResult))
    return
  }

  if (isApiError(plansResult)) {
    setError(getApiErrorMessage(plansResult))
    return
  }

  // Use typed data
  setCases(casesResult.data.cases)
  setRehabilitationPlans(plansResult.data.plans)
} catch (err: any) {
  if (err.name === 'AbortError') {
    return // Request was cancelled, ignore
  }
  setError(err.message || 'An error occurred')
} finally {
  setLoading(false)
}
```

## Benefits

1. **Less Code**: ~50% reduction in boilerplate
2. **Type Safety**: Full TypeScript support
3. **Error Handling**: Consistent across all components
4. **Maintainability**: Changes in one place affect all components
5. **Testability**: Easy to mock services

## Step-by-Step Migration

1. **Import services**:
```typescript
import { clinicianService, isApiError, getApiErrorMessage } from '../../../services'
```

2. **Replace fetch calls**:
```typescript
// Old
const res = await fetch(`${API_BASE_URL}/api/clinician/cases`)

// New
const result = await clinicianService.getCases()
```

3. **Handle errors**:
```typescript
if (isApiError(result)) {
  setError(getApiErrorMessage(result))
  return
}
```

4. **Use typed data**:
```typescript
// TypeScript knows the shape of result.data
setCases(result.data.cases)
```

## Complete Example

```typescript
import { useState, useEffect } from 'react'
import { clinicianService, isApiError, getApiErrorMessage } from '../../../services'
import type { Case, RehabilitationPlan } from '../../../services'

export function ClinicianDashboard() {
  const [cases, setCases] = useState<Case[]>([])
  const [plans, setPlans] = useState<RehabilitationPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const abortController = new AbortController()

    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')

        // Use services instead of direct fetch
        const [casesResult, plansResult] = await Promise.all([
          clinicianService.getCases({ status: 'all', limit: 100 }),
          clinicianService.getRehabilitationPlans({ status: 'active' }),
        ])

        // Handle errors
        if (isApiError(casesResult)) {
          setError(getApiErrorMessage(casesResult))
          return
        }

        if (isApiError(plansResult)) {
          setError(getApiErrorMessage(plansResult))
          return
        }

        // Use typed data
        setCases(casesResult.data.cases)
        setPlans(plansResult.data.plans)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'An error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => {
      abortController.abort()
    }
  }, [])

  // ... rest of component
}
```

