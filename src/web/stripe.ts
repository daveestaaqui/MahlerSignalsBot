import { Hono } from 'hono'

const app = new Hono()

app.post('/webhooks/stripe', async (c: any) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (secret) {
    // TODO: implement webhook validation
  }

  const event = await c.req.json()

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return c.json({ ok: true }, 200)
    default:
      return c.json({ ok: false, error: 'unhandled_event' }, 400)
  }
})

export default app
