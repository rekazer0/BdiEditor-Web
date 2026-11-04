import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const script = readFileSync(new URL('site.js', dist), 'utf8');

// 品牌与核心卖点
assert.match(html, /<title>键设 KeySkin/);
for (const word of ['百度', '搜狗', '手心', '.bdi', '.bds', '.bda', '.ssf', '.sxi', 'keyskin.work', 'github.com/rekazer0/keyskin']) {
  assert.ok(html.includes(word), `首页缺少「${word}」`);
}

// 每段功能演示都要有视频、封面和 GIF，且列表与脚本拼出的路径一致。
const demos = [...html.matchAll(/data-demo="([a-z]+)"/g)].map((match) => match[1]);
assert.deepEqual(demos, ['preview', 'typing', 'edit', 'source', 'motion', 'export', 'mobile']);
for (const name of demos) {
  for (const ext of ['mp4', 'jpg', 'gif']) {
    assert.ok(existsSync(new URL(`assets/demos/${name}.${ext}`, dist)), `缺少 assets/demos/${name}.${ext}`);
  }
}
assert.match(script, /assets\/demos\/\$\{name\}\.mp4/);

// 页面里引用的本地资源都必须存在
const local = [...html.matchAll(/(?:src|href|poster)="([^"#:]+)"/g)].map((match) => match[1]);
for (const path of local) assert.ok(existsSync(new URL(path, dist)), `引用的文件不存在：${path}`);

// 页面内锚点都能找到目标
for (const [, id] of html.matchAll(/href="#([\w-]+)"/g)) assert.match(html, new RegExp(`id="${id}"`), `锚点 #${id} 没有目标`);

console.log(`KeySkin site content test passed (${demos.length} demos, ${local.length} local assets)`);
