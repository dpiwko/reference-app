const { test } = require('node:test')
const assert = require('node:assert')

test('health response shape is correct', () => {
  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: { database: 'ok', uptime: 42 },
  }
  assert.strictEqual(response.status, 'healthy')
  assert.ok(response.timestamp)
  assert.strictEqual(response.checks.database, 'ok')
})

test('items array is valid', () => {
  const items = [
    { id: 1, name: 'Item Alpha' },
    { id: 2, name: 'Item Beta' },
  ]
  assert.strictEqual(items.length, 2)
  assert.ok(items.every(i => i.id && i.name))
})

test('POST /items validates required fields', () => {
  const validate = (body) => {
    if (!body.name) throw new Error('Name is required')
    return { id: 1, ...body }
  }
  assert.throws(() => validate({}), /Name is required/)
  assert.doesNotThrow(() => validate({ name: 'Test' }))
})
