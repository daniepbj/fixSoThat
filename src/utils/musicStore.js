const DB_NAME = "fst_music_db"
const DB_VERSION = 1
const STORE_NAME = "tracks"

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" })
            }
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

function withStore(mode, work) {
    return openDb().then((db) =>
        new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode)
            const store = tx.objectStore(STORE_NAME)
            const request = work(store)

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
            tx.oncomplete = () => db.close()
            tx.onerror = () => reject(tx.error)
        }),
    )
}

function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return `track-${Math.random().toString(36).slice(2, 10)}`
}

export async function listTracks() {
    const rows = await withStore("readonly", (store) => store.getAll())
    return (rows || [])
        .map(({ blob, ...meta }) => meta)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
}

export async function addTrackFromFile(file) {
    const entry = {
        id: createId(),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        createdAt: new Date().toISOString(),
        blob: file,
    }
    await withStore("readwrite", (store) => store.put(entry))
    return entry
}

export async function deleteTrack(id) {
    await withStore("readwrite", (store) => store.delete(id))
}

export async function getTrack(id) {
    if (!id) return null
    return withStore("readonly", (store) => store.get(id))
}
