export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number | null
  error: string | null
}
