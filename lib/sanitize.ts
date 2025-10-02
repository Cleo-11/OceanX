import sanitizeHtmlLib from "sanitize-html"

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g

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

  const stripped = sanitizeWithOptions(value, { allowedTags: [], allowedAttributes: {} })
  const withoutControlChars = stripped.replace(CONTROL_CHAR_PATTERN, "")
  return withoutControlChars.trim().slice(0, maxLength)
}