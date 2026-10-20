import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const tutorial = readFileSync(new URL('../dist/tutorial.html', import.meta.url), 'utf8');
assert.match(html, /界面操作/);
assert.match(html, /源代码操作/);
assert.match(html, /百度/);
assert.match(html, /搜狗/);
assert.match(html, /手心/);
assert.match(html, /chapter-export/);
assert.match(html, /assets\/official-bds-editor\.png/);
console.log('BdiEditor-Web content smoke test passed');


assert.match(tutorial, /每个修改/);
assert.match(tutorial, /同一修改 · 两条路径/);

assert.match(tutorial, /字段级教程/);
assert.match(tutorial, /official-bds-editor\.png/);
assert.match(tutorial, /RootView \/ CandidateView/);
assert.match(tutorial, /skin\.json 是唯一源头/);