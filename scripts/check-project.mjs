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
const javascriptFiles = files.filter((file) => extname(file) === '.js' || extname(file) === '.mjs');

for (const file of javascriptFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const css = readFileSync(join(root, 'style.css'), 'utf8');
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const referencedIds = new Set(
    [...app.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((match) => match[1])
);

const missingIds = [...referencedIds].filter((id) => !ids.has(id));
if (missingIds.length > 0) {
    throw new Error(`app.js references missing HTML ids: ${missingIds.join(', ')}`);
}

if (/^\s*(?:(?:const|let|var)\s+[A-Za-z_$]|function\s+[A-Za-z_$]|document\.)/m.test(css)) {
    throw new Error('style.css appears to contain JavaScript');
}

const assetSources = `${html}\n${css}\n${app}`;
const assetPaths = new Set(
    [...assetSources.matchAll(/(?:images|video)\/[A-Za-z0-9_./-]+/g)]
        .map((match) => match[0].replace(/[)'"`;]+$/, ''))
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

for (const file of files.filter((path) => relative(root, path).startsWith(`api/`))) {
    if (statSync(file).size === 0 || readFileSync(file, 'utf8').trim().length === 0) {
        throw new Error(`Empty API route: ${relative(root, file)}`);
    }
}

const textExtensions = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md', '.yml', '.yaml']);
const telegramToken = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

for (const file of files.filter((path) => textExtensions.has(extname(path)))) {
    const content = readFileSync(file, 'utf8');
    if (telegramToken.test(content) || privateKey.test(content)) {
        throw new Error(`Potential secret committed in ${relative(root, file)}`);
    }
}

console.log(`Validated ${javascriptFiles.length} JavaScript files, ${referencedIds.size} DOM references and ${assetPaths.size} assets.`);
