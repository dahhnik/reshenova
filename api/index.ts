import { app } from '../src/app'

// Vercel serverless entry point — routes via vercel.json rewrites
export default app.fetch
