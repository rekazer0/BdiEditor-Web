import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.match(html, /界面操作/);
assert.match(html, /源代码操作/);
assert.match(html, /百度/);
assert.match(html, /搜狗/);
assert.match(html, /手心/);
assert.match(html, /chapter-export/);
assert.match(html, /assets\/preview-baidu\.png/);
console.log('BdiEditor-Web content smoke test passed');

