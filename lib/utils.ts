export function sanitizeReturnTo(raw?: string | null) {
  if (!raw || typeof raw !== 'string') return null
  // Basic checks: must start with '/', not contain protocol or backslashes, and length limit
  if (!raw.startsWith('/')) return null
  if (raw.includes('://') || raw.includes('\\')) return null
  if (raw.length > 200) return null
  return raw
}

export function isInternalPath(raw?: string | null) {
  return !!sanitizeReturnTo(raw)
}
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
