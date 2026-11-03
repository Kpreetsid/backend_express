'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/]
];
const benign = /(?:SYNTHETIC|example|placeholder|dummy|fake|test[-_ ]?(?:token|key|secret)|YOUR[_ -])/i;

function scan(text, source) {
  const findings = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (benign.test(line)) continue;
    for (const [kind, regex] of patterns) {
      const match = line.match(regex);
      if (match) findings.push({ source, kind, sample: match[0].slice(0, 8) + '…' });
    }
  }
  return findings;
}

function git(args, allowedCodes = [0]) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!allowedCodes.includes(result.status ?? 1)) {
    throw new Error(`git ${args[0]} failed with exit ${result.status}: ${result.stderr || ''}`);
  }
  return result.stdout || '';
}

const currentText = git(['grep', '-I', '-n', '-E', '-e',
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{20,}',
  '--', '.', ':(exclude)package-lock.json'
], [0, 1]);
const current = scan(currentText, 'current-tree');

const historyPatch = git(['log', '--all', '--no-ext-diff', '--format=commit:%H', '-p', '--unified=0', '--', '.', ':(exclude)package-lock.json']);
const history = scan(
  historyPatch.split(/\r?\n/).filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n'),
  'git-history'
);

const unique = [...new Map([...current, ...history].map(item => [JSON.stringify(item), item])).values()];
const report = { scannedAt: new Date().toISOString(), findings: unique, currentCount: current.length, historyCount: history.length };
fs.writeFileSync('secret-scan.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ currentCount: current.length, historyCount: history.length }));

if (unique.length) process.exit(1);
