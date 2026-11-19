import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const script = readFileSync(new URL('site.js', dist), 'utf8');

// 品牌与核心卖点
assert.match(html, /<title>键设 KeySkin/);
for (const word of ['百度', '搜狗', '手心', '.bdi', '.bds', '.bda', '.ssf', '.sxi', 'keyskin.work', 'github.com/rekazer0/keyskin']) {
  assert.ok(html.includes(word), `首页缺少「${word}」`);
}
assert.match(html, /href="https:\/\/keyskin\.work\/demo\//);
assert.doesNotMatch(html, /href="https:\/\/keyskin\.work\/demo"/);

// 首屏直接渲染九键工作区，只有下方功能演示使用动图。
const hero = html.match(/<section class="hero">[\s\S]*?<\/section>/)[0];
assert.doesNotMatch(hero, /<video|\.(?:gif|mp4)\b/);
assert.equal([...hero.matchAll(/class="ws-key ws-selected"/g)].length, 9);
const icons = readFileSync(new URL('assets/workspace-icons.svg', dist), 'utf8');
for (const [, id] of hero.matchAll(/workspace-icons\.svg#(\w+)/g)) assert.ok(icons.includes(`id="${id}"`));
assert.deepEqual([...html.matchAll(/data-demo="(\w+)" data-gif/g)].map(match => match[1]), ['motion', 'adb', 'toolbar', 'theme']);
assert.match(html, /<p class="eyebrow">动效<\/p>[^]*?<\/article>\s*<article[^>]+>\s*<div class="feature-copy">\s*<p class="eyebrow">转换<\/p>/);

// 每段功能演示都要有视频、封面和 GIF，且列表与脚本拼出的路径一致。
const demos = [...html.matchAll(/data-demo="([a-z]+)"/g)].map((match) => match[1]);
assert.deepEqual(demos, ['preview', 'typing', 'edit', 'source', 'resources', 'motion', 'export', 'adb', 'toolbar', 'theme', 'mobile']);
const media = new URL('assets/demos/', dist);
const expected = demos.flatMap(name => ['gif', 'jpg', 'mp4'].map(ext => `${name}.${ext}`));
assert.deepEqual(readdirSync(media).filter(name => !name.startsWith('.')).sort(), expected.sort());
for (const name of expected) {
  const bytes = readFileSync(new URL(name, media));
  assert.ok(bytes.length > 100, `演示素材为空：${name}`);
  if (name.endsWith('.gif')) assert.equal(bytes.subarray(0, 6).toString(), 'GIF89a');
  if (name.endsWith('.jpg')) assert.equal(bytes.readUInt16BE(0), 0xffd8);
  if (name.endsWith('.mp4')) assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
}
const recorder = readFileSync(new URL('../scripts/record-demos.mjs', import.meta.url), 'utf8');
assert.deepEqual([...recorder.matchAll(/^scenes\.(\w+) =/gm)].map(match => match[1]), demos);
assert.doesNotMatch(recorder, /setInputFiles|bda-animation-fixture|#browser-open/);
assert.match(script, /assets\/demos\/\$\{name\}\.mp4/);

// 页面里引用的本地资源都必须存在
const local = [...html.matchAll(/(?:src|href|poster)="([^"#:]+)"/g)].map((match) => match[1]);
for (const path of local) assert.ok(existsSync(new URL(path, dist)), `引用的文件不存在：${path}`);

// 页面内锚点都能找到目标
for (const [, id] of html.matchAll(/href="#([\w-]+)"/g)) assert.match(html, new RegExp(`id="${id}"`), `锚点 #${id} 没有目标`);

console.log(`KeySkin site content test passed (${demos.length} demos, ${local.length} local assets)`);
