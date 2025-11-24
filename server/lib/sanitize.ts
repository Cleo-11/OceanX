import sanitizeHtmlLib from "sanitize-html"

// Control characters to remove, EXCLUDING normal whitespace (tab=09, LF=0A, CR=0D)
// Removes chars 00-08, 0B-0C, 0E-1F, and other special control chars
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g

const DEFAULT_ALLOWED_TAGS: string[] = [
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]

type AllowedAttribute = string | { name: string; multiple?: boolean; values: string[] }
type AttributeMap = Record<string, AllowedAttribute[]>

const DEFAULT_ALLOWED_ATTRIBUTES: AttributeMap = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "loading"],
  "*": ["class", "id", "data-*", "aria-*"],
}

type SanitizeOptions = {
  allowedTags?: string[]
  allowedAttributes?: AttributeMap
  allowedSchemes?: string[]
  disallowedTagsMode?: "discard" | "escape" | "recursiveEscape"
}

const sanitizeWithOptions = (dirty: string, options?: SanitizeOptions) =>
  sanitizeHtmlLib(dirty, {
    allowedTags: [...DEFAULT_ALLOWED_TAGS],
    allowedAttributes: DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    disallowedTagsMode: "discard",
    ...options,
  })

export const sanitizeHtml = (dirty: string, maxLength = Number.POSITIVE_INFINITY): string => {
  if (typeof dirty !== "string") {
    return ""
  }

  const sanitized = sanitizeWithOptions(dirty)
  if (Number.isFinite(maxLength) && sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength)
  }
  return sanitized
}

export const sanitizePlainText = (value: unknown, maxLength = 512): string => {
  if (typeof value !== "string") {
    return ""
  }

  // For plain text that needs whitespace preserved, manually strip HTML tags
  // This avoids sanitize-html's whitespace normalization
  let stripped = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/<[^>]+>/g, '') // Remove all other HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Remove control chars (but preserve normal whitespace like \\n, \\t, \\r)
  const withoutControlChars = stripped.replace(CONTROL_CHAR_PATTERN, "")
  if (Number.isFinite(maxLength) && withoutControlChars.length > maxLength) {
    return withoutControlChars.slice(0, maxLength)
  }
  return withoutControlChars
}
