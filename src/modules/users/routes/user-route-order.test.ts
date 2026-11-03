import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('specific user location route is registered before generic user-id route', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/modules/users/routes/user.routes.ts'), 'utf8');
  const locationIndex = source.indexOf("userRouter.get('/location/:id'");
  const genericIndex = source.indexOf("userRouter.get('/:id'");
  assert.ok(locationIndex >= 0, 'location route must exist');
  assert.ok(genericIndex >= 0, 'generic user route must exist');
  assert.ok(locationIndex < genericIndex, 'specific /location/:id route must precede /:id');
});
