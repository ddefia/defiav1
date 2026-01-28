import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required')
}

const encryptionKey: string = ENCRYPTION_KEY

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, encryptionKey).toString()
}

export function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, encryptionKey)
  return bytes.toString(CryptoJS.enc.Utf8)
}
