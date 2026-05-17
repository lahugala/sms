/**
 * Contacts store — persisted to localStorage.
 * Each contact: { id, name, phone }
 */
import { reactive } from 'vue'

const STORAGE_KEY = 'sms_gateway_contacts'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function persist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export const contactStore = reactive({
  contacts: load(),

  get total() { return this.contacts.length },
})

export function addContacts(newContacts) {
  // Deduplicate by phone number (normalised — strip spaces/dashes)
  const norm  = p => p.replace(/[\s\-().]/g, '')
  const existing = new Set(contactStore.contacts.map(c => norm(c.phone)))

  let added = 0
  for (const c of newContacts) {
    const key = norm(c.phone)
    if (key && !existing.has(key)) {
      contactStore.contacts.push({ id: crypto.randomUUID(), name: c.name || '', phone: c.phone })
      existing.add(key)
      added++
    }
  }
  persist(contactStore.contacts)
  return added
}

export function removeContact(id) {
  const idx = contactStore.contacts.findIndex(c => c.id === id)
  if (idx !== -1) { contactStore.contacts.splice(idx, 1); persist(contactStore.contacts) }
}

export function clearContacts() {
  contactStore.contacts.splice(0)
  localStorage.removeItem(STORAGE_KEY)
}

// ── Parsers ────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into [{ name, phone }].
 * Auto-detects columns — looks for headers like name/phone/mobile/cell/number.
 * Falls back to first two columns if no headers match.
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 1) return []

  // Detect delimiter: comma or semicolon
  const delim = lines[0].includes(';') ? ';' : ','

  const splitLine = (line) => {
    // Handle quoted fields
    const result = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === delim && !inQ) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))

  // Find name and phone column indices
  const nameIdx  = headers.findIndex(h => /^(name|fullname|contact|first|fname|givenname)/.test(h))
  const phoneIdx = headers.findIndex(h => /^(phone|mobile|cell|number|tel|msisdn|phonenumber|mobilephone)/.test(h))

  // If no headers match, treat first row as data (col 0 = name, col 1 = phone)
  const hasHeaders = nameIdx !== -1 || phoneIdx !== -1
  const dataStart  = hasHeaders ? 1 : 0
  const ni = nameIdx  !== -1 ? nameIdx  : 0
  const pi = phoneIdx !== -1 ? phoneIdx : 1

  const result = []
  for (let i = dataStart; i < lines.length; i++) {
    const cols  = splitLine(lines[i])
    const phone = (cols[pi] || '').replace(/[^\d+]/g, '')   // keep digits and +
    if (phone.length < 7) continue   // skip obviously invalid
    result.push({ name: cols[ni]?.replace(/^"|"$/g, '') || '', phone })
  }
  return result
}

/**
 * Parse a vCard (.vcf) string into [{ name, phone }].
 * Handles vCard 2.1, 3.0, and 4.0.
 */
export function parseVCard(text) {
  const contacts = []
  const cards    = text.split(/BEGIN:VCARD/i).slice(1)

  for (const card of cards) {
    const lines = card.split(/\r?\n/)
    let name = '', phone = ''

    for (const line of lines) {
      const upper = line.toUpperCase()
      if (upper.startsWith('FN:')) {
        name = line.slice(3).trim()
      } else if (upper.startsWith('N:') && !name) {
        // N: Last;First;Middle;Prefix;Suffix
        const parts = line.slice(2).split(';')
        name = [parts[1], parts[0]].filter(Boolean).join(' ').trim()
      } else if (upper.startsWith('TEL') && line.includes(':')) {
        const raw   = line.split(':').slice(1).join(':').trim()
        const clean = raw.replace(/[^\d+]/g, '')
        if (clean.length >= 7 && !phone) phone = clean
      }
    }

    if (phone) contacts.push({ name, phone })
  }
  return contacts
}
