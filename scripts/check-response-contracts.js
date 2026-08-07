const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src');
const baselinePath = path.join(projectRoot, '.ai', 'baselines', 'response-contracts.json');
const writeMode = process.argv.includes('--write');
const responseMethods = new Set(['json', 'jsonp', 'send', 'sendStatus', 'redirect', 'end']);
const responseIdentifiers = new Set(['res', 'response']);

function listTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(absolutePath);
    }
    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      return [absolutePath];
    }
    return [];
  });
}

function getRootIdentifier(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return getRootIdentifier(expression.expression);
  }
  if (ts.isCallExpression(expression)) {
    return getRootIdentifier(expression.expression);
  }
  if (ts.isElementAccessExpression(expression)) {
    return getRootIdentifier(expression.expression);
  }
  return undefined;
}

function getStatus(expression, responseMethod, sourceFile) {
  if (responseMethod === 'sendStatus') {
    return expression.arguments[0]?.getText(sourceFile) || 'dynamic';
  }

  let current = expression.expression.expression;
  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === 'status'
    ) {
      return current.arguments[0]?.getText(sourceFile) || 'dynamic';
    }
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }

  return responseMethod === 'redirect' ? 'redirect' : '200';
}

function propertyName(property, sourceFile) {
  if (ts.isSpreadAssignment(property)) {
    return `...${property.expression.getText(sourceFile)}`;
  }
  if (!property.name) {
    return property.getText(sourceFile);
  }
  if (ts.isComputedPropertyName(property.name)) {
    return `[${property.name.expression.getText(sourceFile)}]`;
  }
  return property.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
}

function getPayloadShape(argument, sourceFile) {
  if (!argument) {
    return { kind: 'empty', keys: [] };
  }
  if (ts.isObjectLiteralExpression(argument)) {
    return {
      kind: 'object',
      keys: argument.properties.map((property) => propertyName(property, sourceFile)).sort()
    };
  }
  if (ts.isArrayLiteralExpression(argument)) {
    return { kind: 'array', keys: [] };
  }
  if (ts.isStringLiteralLike(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return { kind: 'string', keys: [] };
  }
  if (argument.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: 'null', keys: [] };
  }
  return {
    kind: ts.SyntaxKind[argument.kind] || 'dynamic',
    keys: [],
    expression: argument.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 240)
  };
}

function collectContracts(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const relativeFile = path.relative(projectRoot, filePath).replaceAll('\\', '/');
  const entries = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      responseMethods.has(node.expression.name.text) &&
      responseIdentifiers.has(getRootIdentifier(node.expression.expression))
    ) {
      const method = node.expression.name.text;
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const payload = getPayloadShape(node.arguments[0], sourceFile);
      const normalizedCall = node.getText(sourceFile).replace(/\s+/g, ' ');
      entries.push({
        file: relativeFile,
        line: position.line + 1,
        method,
        status: getStatus(node, method, sourceFile),
        payload,
        callHash: crypto.createHash('sha256').update(normalizedCall).digest('hex')
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

const contracts = listTypeScriptFiles(sourceRoot)
  .flatMap(collectContracts)
  .sort((left, right) =>
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.method.localeCompare(right.method)
  );

const baseline = {
  version: 1,
  generatedFrom: 'Express response call sites in src/**/*.ts',
  count: contracts.length,
  contracts
};
const serialized = `${JSON.stringify(baseline, null, 2)}\n`;

if (writeMode) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, serialized);
  console.log(`Response contract baseline written (${contracts.length} call sites).`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('Response contract baseline is missing. Run npm run generate:response-contracts.');
  process.exit(1);
}

const existing = fs.readFileSync(baselinePath, 'utf8').replace(/\r\n/g, '\n');
const semanticContracts = (value) => ({
  version: value.version,
  generatedFrom: value.generatedFrom,
  count: value.count,
  contracts: value.contracts.map(({ line, ...contract }) => contract)
});
let existingBaseline;
try {
  existingBaseline = JSON.parse(existing);
} catch {
  console.error('Response contract baseline is not valid JSON.');
  process.exit(1);
}
if (
  JSON.stringify(semanticContracts(existingBaseline)) !==
  JSON.stringify(semanticContracts(baseline))
) {
  console.error(
    'Express response contracts changed. Preserve existing status/payload shapes or intentionally regenerate and review the baseline.'
  );
  process.exit(1);
}

console.log(`Response contract baseline verified (${contracts.length} call sites).`);
