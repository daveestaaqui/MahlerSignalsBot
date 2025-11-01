import { describe, it, expect } from 'vitest'
import request from 'supertest'

let app: any
try {
  // prefer app exported from source
  app = require('../src/web/server').app
} catch {}
describe('health/status', () => {
  it('GET /status returns 200', async () => {
    if (app) {
      const res = await request(app).get('/status')
      expect([200,204]).toContain(res.status)
    } else if (process.env.BASE) {
      const res = await fetch(process.env.BASE.replace(/\/$/,'') + '/status')
      expect([200,204]).toContain(res.status)
    } else {
      throw new Error('No app or BASE provided')
    }
  })
  it('GET /healthz returns 200', async () => {
    if (app) {
      const res = await request(app).get('/healthz')
      expect([200,204]).toContain(res.status)
    } else if (process.env.BASE) {
      const res = await fetch(process.env.BASE.replace(/\/$/,'') + '/healthz')
      expect([200,204]).toContain(res.status)
    } else {
      throw new Error('No app or BASE provided')
    }
  })
})
