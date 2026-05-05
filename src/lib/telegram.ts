export function validateWebhookSecret(header: string, projectSecret: string): boolean {
  return header === projectSecret
}

export async function getChat(chatId: number): Promise<{ id: number; title: string }> {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${chatId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`getChat failed: ${res.status}`)
  const data = (await res.json()) as { ok: boolean; result?: { id: number; title: string } }
  if (!data.ok || !data.result) throw new Error(`getChat returned not ok`)
  return data.result
}
