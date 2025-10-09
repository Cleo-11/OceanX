const { sanitizeHtml, sanitizePlainText } = require('../lib/sanitize');

describe('Sanitization Functions', () => {
  describe('sanitizeHtml', () => {
    it('should remove dangerous script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Hello</p>');
      expect(result).not.toContain('script');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<div>Click me</div>');
      expect(result).not.toContain('onclick');
    });

    it('should allow safe HTML tags', () => {
      const input = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('<p>');
    });

    it('should handle malformed HTML gracefully', () => {
      const input = '<p>Unclosed paragraph<div>Mixed tags</p></div>';
      const result = sanitizeHtml(input);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizePlainText', () => {
    it('should remove HTML tags completely', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = sanitizePlainText(input);
      expect(result).toBe('Hello world');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00\x01\x02world\x7f';
      const result = sanitizePlainText(input);
      expect(result).toBe('Helloworld');
    });

    it('should preserve normal whitespace', () => {
      const input = 'Hello\n\tworld\r\n';
      const result = sanitizePlainText(input);
      expect(result).toBe('Hello\n\tworld\r\n');
    });

    it('should handle empty strings', () => {
      const result = sanitizePlainText('');
      expect(result).toBe('');
    });

    it('should handle null/undefined inputs', () => {
      expect(sanitizePlainText(null)).toBe('');
      expect(sanitizePlainText(undefined)).toBe('');
    });

    it('should remove dangerous unicode characters', () => {
      const input = 'Hello\u202eworld'; // Right-to-left override
      const result = sanitizePlainText(input);
      expect(result).toBe('Helloworld');
    });

    it('should preserve emoji and normal unicode', () => {
      const input = 'Hello 👋 世界';
      const result = sanitizePlainText(input);
      expect(result).toBe('Hello 👋 世界');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000) + '<script>alert(1)</script>';
      const result = sanitizeHtml(longString);
      expect(result.length).toBeGreaterThan(5000);
      expect(result).not.toContain('script');
    });

    it('should handle special characters in HTML', () => {
      const input = '<p>Price: $100 &amp; €50</p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('$100');
      expect(result).toContain('€50');
    });

    it('should handle nested malicious content', () => {
      const input = '<div><p><script>alert(1)</script></p></div>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<div><p></p></div>');
    });
  });
});