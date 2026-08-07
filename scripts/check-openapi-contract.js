const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const baselinePath = path.join(repositoryRoot, '.ai', 'baselines', 'openapi.json');
const routeFilePattern = /\.(routes?|controller)\.ts$/i;
const routePattern = /\b(?:app|router|outer|apiRouter|healthRouter|metricsRouter|cryptoRouter|[A-Za-z_$][\w$]*Router)\s*\.\s*(get|post|put|patch|delete|options|head|use)\s*\(\s*(\[[^\]]+\]|`[^`]+`|'[^']+'|"[^"]+")/g;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function routeDeclarations() {
  const sourceFiles = walk(sourceRoot);
  const candidates = sourceFiles
    .filter((file) => routeFilePattern.test(file) || path.basename(file) === 'app.ts')
    .sort();

  const declarations = candidates.flatMap((file) => {
    const sourceFile = path.relative(repositoryRoot, file).replaceAll('\\', '/');
    const routeDirectory = path.dirname(file);
    const validators = sourceFiles
      .filter((candidate) =>
        path.dirname(candidate) === routeDirectory
        && /\.(validator|validation)\.ts$/i.test(candidate)
      )
      .map((candidate) => path.relative(repositoryRoot, candidate).replaceAll('\\', '/'))
      .sort();
    const source = fs.readFileSync(file, 'utf8');
    const declarations = [];
    let match;
    while ((match = routePattern.exec(source)) !== null) {
      declarations.push({
        sourceFile,
        method: match[1].toUpperCase(),
        pathExpression: match[2].replace(/\s+/g, ' ').trim(),
        validatorSources: validators
      });
    }
    return declarations;
  });
  return [...new Map(
    declarations.map((declaration) => [
      `${declaration.sourceFile} ${declaration.method} ${declaration.pathExpression}`,
      declaration
    ])
  ).values()].sort((left, right) =>
    `${left.sourceFile} ${left.method} ${left.pathExpression}`
      .localeCompare(`${right.sourceFile} ${right.method} ${right.pathExpression}`)
  );
}

function createDocument() {
  const declarations = routeDeclarations();
  return {
    openapi: '3.1.0',
    info: {
      title: 'CMMS API compatibility catalog',
      version: '1.0.0',
      description: 'Generated from the existing Express route graph. Existing paths, methods, payloads, status codes, and response fields remain immutable.'
    },
    servers: [
      { url: '/api', description: 'Canonical compatibility alias' },
      { url: '/api/v1', description: 'Versioned compatibility alias' }
    ],
    paths: {
      '/': {
        get: {
          operationId: 'welcome',
          responses: {
            200: {
              description: 'API welcome response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CompatibilityResponse' }
                }
              }
            }
          }
        }
      },
      '/health/live': {
        get: {
          operationId: 'liveness',
          responses: { 200: { description: 'Process is alive' } }
        }
      },
      '/health/ready': {
        get: {
          operationId: 'readiness',
          responses: {
            200: { description: 'Required dependencies are ready' },
            503: { description: 'A required dependency is not ready' }
          }
        }
      },
      '/metrics': {
        get: {
          operationId: 'prometheusMetrics',
          security: [{ metricsToken: [] }],
          responses: {
            200: {
              description: 'Prometheus metrics',
              content: { 'text/plain': { schema: { type: 'string' } } }
            },
            401: { description: 'Metrics bearer credential is missing or invalid' }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        accountId: { type: 'apiKey', in: 'header', name: 'accountID' },
        payloadCryptoKey: { type: 'apiKey', in: 'header', name: 'X-CMMS-Crypto-Key-Id' },
        metricsToken: { type: 'http', scheme: 'bearer' },
        processorToken: { type: 'apiKey', in: 'header', name: 'X-CMMS-Processor-Token' }
      },
      schemas: {
        CompatibilityResponse: {
          type: 'object',
          additionalProperties: true,
          required: ['status', 'message'],
          properties: {
            status: { type: 'boolean' },
            message: { type: 'string' },
            data: {},
            error: { type: 'string' },
            errors: { type: 'array', items: {} }
          }
        }
      }
    },
    'x-cmms-compatibility': {
      routeDeclarationCount: declarations.length,
      aliases: ['/api', '/api/v1', '${API_BASE_PATH}/api', '${API_BASE_PATH}/api/v1'],
      generatedFrom: 'src/**/*.routes.ts, src/**/*controller.ts, src/app.ts',
      note: 'The declaration catalog preserves legacy route expressions while request and response schemas are added incrementally without normalizing existing contracts.'
    },
    'x-cmms-protected-routes': {
      processorTokenBootstrap: {
        method: 'GET',
        path: '/api/users/create_external_token/{email}',
        security: [{ processorToken: [] }],
        note: 'The existing route and response are preserved; a processor-only credential is required before a token can be minted.'
      }
    },
    'x-cmms-route-declarations': declarations
  };
}

const serialized = `${JSON.stringify(createDocument(), null, 2)}\n`;

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, serialized);
  console.log(`Wrote ${baselinePath}`);
  process.exit(0);
}

if (process.argv.includes('--print')) {
  process.stdout.write(serialized);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing generated OpenAPI baseline: ${baselinePath}`);
  process.exit(1);
}

if (fs.readFileSync(baselinePath, 'utf8') !== serialized) {
  console.error('OpenAPI compatibility catalog is stale or the route graph changed.');
  console.error('Run `npm run generate:openapi`, review the diff, and obtain compatibility approval.');
  process.exit(1);
}

console.log(`OpenAPI 3.1 compatibility catalog verified (${createDocument()['x-cmms-route-declarations'].length} declarations).`);
