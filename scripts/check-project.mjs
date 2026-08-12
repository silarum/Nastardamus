import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (ignoredDirectories.has(entry.name)) return [];
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
    });
}

const files = walk(root);
const javascriptFiles = files.filter((file) => ['.js', '.mjs'].includes(extname(file)));
for (const file of javascriptFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

for (const page of ['index.html']) {
    if (!existsSync(join(root, page))) throw new Error(`Missing page: ${page}`);
}

for (const privateControlFile of ['admin/index.html', 'admin/admin.css', 'admin/admin.js']) {
    if (existsSync(join(root, privateControlFile))) {
        throw new Error(`Protected control file must not be publicly deployable: ${privateControlFile}`);
    }
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'ui-kit/app.js'), 'utf8');
const css = readFileSync(join(root, 'ui-kit/app.css'), 'utf8');
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const referencedIds = new Set(
    [...app.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((match) => match[1])
);
const missingIds = [...referencedIds].filter((id) => !ids.has(id));
if (missingIds.length > 0) {
    throw new Error(`ui-kit/app.js references missing HTML ids: ${missingIds.join(', ')}`);
}

if (/^\s*(?:(?:const|let|var)\s+[A-Za-z_$]|function\s+[A-Za-z_$]|document\.)/m.test(css)) {
    throw new Error('ui-kit/app.css appears to contain JavaScript');
}

for (const required of ['/ui-kit/tokens.css', '/ui-kit/components.css', '/ui-kit/app.css', '/ui-kit/worlds-v5.css', '/ui-kit/app.bundle.js']) {
    if (!html.includes(required)) throw new Error(`Main page does not load ${required}`);
}

for (const legacyScript of ['app.js', 'experience-v4.js', 'ritual-v4.js', 'runtime-v4.js']) {
    if (new RegExp(`<script[^>]+src=["']/?${legacyScript.replace('.', '\\.')}`).test(html)) {
        throw new Error(`Legacy client script is still active: ${legacyScript}`);
    }
}

if (app.includes('stopImmediatePropagation')) {
    throw new Error('Premium application must not block other click handlers');
}

const assetSources = files
    .filter((file) => ['.html', '.css', '.js'].includes(extname(file)))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
const assetPaths = new Set(
    [...assetSources.matchAll(/(?:^|["'`(])\/?((?:images|video)\/[A-Za-z0-9_./-]+)/gm)]
        .map((match) => match[1].replace(/[)'"`;]+$/, ''))
        .filter((path) => !path.includes('${'))
);
const missingAssets = [...assetPaths].filter((path) => !existsSync(join(root, path)));
if (missingAssets.length > 0) {
    throw new Error(`Missing assets: ${missingAssets.join(', ')}`);
}

const mediaFiles = files.filter((path) => {
    const projectPath = relative(root, path);
    return projectPath.startsWith('images/') || projectPath.startsWith('video/');
});
const emptyMedia = mediaFiles.filter((file) => statSync(file).size === 0);
if (emptyMedia.length > 0) {
    throw new Error(`Empty media assets: ${emptyMedia.map((file) => relative(root, file)).join(', ')}`);
}

const invalidMp4Files = mediaFiles
    .filter((file) => extname(file).toLowerCase() === '.mp4')
    .filter((file) => {
        const data = readFileSync(file);
        return !data.includes(Buffer.from('ftyp')) || !data.includes(Buffer.from('moov'));
    });
if (invalidMp4Files.length > 0) {
    throw new Error(`Invalid MP4 assets: ${invalidMp4Files.map((file) => relative(root, file)).join(', ')}`);
}

for (const file of files.filter((path) => relative(root, path).startsWith('api/'))) {
    if (statSync(file).size === 0 || readFileSync(file, 'utf8').trim().length === 0) {
        throw new Error(`Empty API route: ${relative(root, file)}`);
    }
}

const textExtensions = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md', '.yml', '.yaml']);
const telegramToken = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
const openAiKey = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
for (const file of files.filter((path) => textExtensions.has(extname(path)))) {
    const content = readFileSync(file, 'utf8');
    if (telegramToken.test(content) || openAiKey.test(content) || privateKey.test(content)) {
        throw new Error(`Potential secret committed in ${relative(root, file)}`);
    }
}

console.log(`Validated ${javascriptFiles.length} JavaScript files, ${referencedIds.size} DOM references and ${assetPaths.size} assets.`);
