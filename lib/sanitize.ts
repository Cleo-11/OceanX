import DOMPurify from "isomorphic-dompurify"

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g

export const sanitizeHtml = (dirty: string, maxLength = 5000): string => {
  if (typeof dirty !== "string") {
    return ""
  }
  const truncated = dirty.slice(0, maxLength)
  return DOMPurify.sanitize(truncated, { USE_PROFILES: { html: true } })
}

export const sanitizePlainText = (value: unknown, maxLength = 512): string => {
  if (typeof value !== "string") {
    return ""
  }
  return value.trim().replace(CONTROL_CHAR_PATTERN, "").slice(0, maxLength)
}