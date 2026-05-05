import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { queueRoute } from './routes/queue'
import { candidatesRoute } from './routes/candidates'
import { webhookRoute } from './routes/webhook'

export type Variables = { userId: string }

export const app = new Hono<{ Variables: Variables }>().basePath('/api')

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://reshenova.vercel.app'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Telegram-Bot-Api-Secret-Token'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)
})

app.route('/', queueRoute)
app.route('/', candidatesRoute)
app.route('/', webhookRoute)

app.notFound((c) => c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404))
