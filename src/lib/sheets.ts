import { google } from 'googleapis'

export async function writeCell(sheetId: string, cellRef: string, value: string): Promise<void> {
  const raw = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!, 'base64').toString('utf-8')
  const credentials = JSON.parse(raw) as object

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cellRef,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}
