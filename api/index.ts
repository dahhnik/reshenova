// Phase 1 placeholder — replaced with Hono app in Phase 2
export default async function handler(_req: Request): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
