// Persists in-flight Cloudflare R2 multipart upload state to localStorage so a
// page reload / network blip can pick up where it left off. The browser cannot
// re-acquire a File handle automatically (security), so resume requires the
// user to drop the same file again — we match by name+size+lastModified.

const KEY = 'mpuPending'
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch (e) { console.warn('mpuStore save failed', e) }
}

export function fileSig(file) {
  return `${file.name}|${file.size}|${file.lastModified}`
}

export function recordCreate(entry) {
  const data = load()
  data[entry.uploadId] = { ...entry, completedParts: [], createdAt: Date.now() }
  save(data)
}

export function recordPart(uploadId, partNumber, etag) {
  const data = load()
  const e = data[uploadId]
  if (!e) return
  if (!e.completedParts.some(p => p.partNumber === partNumber)) {
    e.completedParts.push({ partNumber, etag })
    save(data)
  }
}

export function recordRemove(uploadId) {
  const data = load()
  if (data[uploadId]) {
    delete data[uploadId]
    save(data)
  }
}

export function findResumable(file, endPoint) {
  const sig = fileSig(file)
  const data = load()
  for (const id in data) {
    const e = data[id]
    if (e.endPoint === endPoint && e.fileSig === sig) return e
  }
  return null
}

export function listForEndpoint(endPoint) {
  const data = load()
  return Object.values(data).filter(e => e.endPoint === endPoint)
}

export function pruneStale() {
  const data = load()
  const now = Date.now()
  let changed = false
  for (const id in data) {
    if (now - data[id].createdAt > STALE_AFTER_MS) {
      delete data[id]
      changed = true
    }
  }
  if (changed) save(data)
}

export function clearAll() {
  save({})
}
