/**
 * getErrorMessage — safely extracts a human-readable string from any thrown
 * API error, including FastAPI 422 validation responses whose `detail` field
 * is an array of { type, loc, msg, input } objects (Pydantic v2 format).
 *
 * Usage:
 *   catch (err) { setError(getErrorMessage(err, 'Something went wrong')) }
 */

type PydanticDetail = { msg?: string; type?: string; loc?: unknown[] }
type ApiError = {
    response?: {
        data?: {
            detail?: string | PydanticDetail | PydanticDetail[]
        }
    }
}

export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
    const apiErr = err as ApiError
    const detail = apiErr?.response?.data?.detail

    if (!detail) {
        // Try native Error message as last resort
        if (err instanceof Error && err.message) return err.message
        return fallback
    }

    // FastAPI 422: detail is an array of Pydantic validation errors
    if (Array.isArray(detail)) {
        const msgs = detail
            .map((d) => (typeof d === 'object' && d !== null ? (d as PydanticDetail).msg ?? '' : String(d)))
            .filter(Boolean)
        return msgs.length > 0 ? msgs.join('. ') : fallback
    }

    // FastAPI string detail (e.g. 401 "Invalid credentials")
    if (typeof detail === 'string' && detail.trim()) return detail.trim()

    // Pydantic single-object detail (rare)
    if (typeof detail === 'object' && (detail as PydanticDetail).msg) {
        return (detail as PydanticDetail).msg!
    }

    return fallback
}
