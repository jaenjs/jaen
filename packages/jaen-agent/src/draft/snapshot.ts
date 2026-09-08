/**
 * The backstop: one blob per site, outside the object that made it.
 *
 * `draft-state.md` asks the object to "write a snapshot of the draft every few
 * minutes and when the last editor leaves, into one file that is not part of
 * the chain". `okf/decisions/hard-rules.md` is narrower about where that file
 * may be, and it wins: a draft "reaches no repository and no gateway file, and
 * nothing in patches.txt ever names it". Those two sentences disagree about
 * the snapshot's home, so the snapshot goes where both are satisfied: a KV
 * entry, which is neither a repository nor a gateway file, is not in the chain
 * and cannot be reached by a build.
 *
 * That is a deliberate departure from the design's wording, recorded in
 * draft-state.md under "The snapshot's home", and it keeps the purpose: the
 * backstop is a different storage system from the one it backs up, so losing
 * the object does not lose the draft.
 *
 * Two entries and not one, because a snapshot that is written wrong must not
 * be the only copy: `draft-snapshot:<site>` is the current one and
 * `draft-snapshot:<site>:previous` is the one it replaced. No expiry: a
 * backstop that expires is not one.
 *
 * Two kinds, and they are kept apart on purpose. `draft` is the alarm's
 * rolling backstop. `discard` is the draft as it stood one instant before a
 * site wide discard, and it must survive every alarm that runs afterwards: a
 * discard changes the revision, so the very next alarm takes a snapshot, and
 * had the two shared a key the undo of a discard would have been rotated away
 * within the interval. That is what makes a discard undoable rather than
 * merely snapshotted.
 *
 * The sink is an interface because the store is. A single process
 * implementation writes the same JSON to a file beside its database.
 */
import type {DraftSnapshot} from './store'

export type SnapshotKind = 'draft' | 'discard'

export interface SnapshotSink {
  put(snapshot: DraftSnapshot, kind?: SnapshotKind): Promise<number>
  get(site: string, kind?: SnapshotKind): Promise<DraftSnapshot | null>
}

const key = (site: string, kind: SnapshotKind = 'draft') =>
  kind === 'discard' ? `draft-discard:${site}` : `draft-snapshot:${site}`

export const kvSnapshotSink = (kv: KVNamespace | null): SnapshotSink => ({
  put: async (snapshot, kind = 'draft') => {
    const body = JSON.stringify(snapshot)

    if (!kv) {
      // A runner with no KV bound still takes snapshots, they just have
      // nowhere to go. Saying so beats a silent no-op, and the object's own
      // meta records the bytes either way.
      console.warn(
        'jaen-agent: no KV is bound, the draft snapshot has nowhere to go'
      )

      return body.length
    }

    const previous = await kv.get(key(snapshot.site, kind)).catch(() => null)

    if (previous) {
      await kv
        .put(`${key(snapshot.site, kind)}:previous`, previous)
        .catch(error => console.error('jaen-agent: snapshot rotate', error))
    }

    await kv.put(key(snapshot.site, kind), body)

    return body.length
  },

  get: async (site, kind = 'draft') => {
    if (!kv) return null

    const raw = await kv.get(key(site, kind)).catch(() => null)

    if (!raw) return null

    try {
      return JSON.parse(raw) as DraftSnapshot
    } catch {
      return null
    }
  }
})
