import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './paperGenerator';

test('escapeHtml escapes all five HTML-significant characters', () => {
  const input = `<script>alert('x')</script> & "quoted"`;
  const escaped = escapeHtml(input);
  assert.equal(
    escaped,
    '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;'
  );
  // None of the raw special characters should survive.
  for (const char of ['<', '>', '"', "'"]) {
    assert.ok(!escaped.includes(char), `escaped output still contains raw "${char}"`);
  }
});

test('escapeHtml is a no-op for a benign, plain name', () => {
  assert.equal(escapeHtml('Aarav Sharma'), 'Aarav Sharma');
});

test('escapeHtml neutralizes an onerror-image injection attempt', () => {
  const malicious = `<img src=x onerror="fetch('http://internal-host/steal')">`;
  const escaped = escapeHtml(malicious);
  assert.ok(!escaped.includes('<img'), 'escaped output must not contain a live <img> tag');
});
