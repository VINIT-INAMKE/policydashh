// A1: Shared pending-upload registry between BlockEditor (drop/paste handlers)
// and ImageBlockView (NodeView). When a user drops or pastes an image, the
// drop handler inserts an image node with an empty `src` and a unique
// `pendingUploadId` attribute, and stores the raw `File` here. The NodeView
// reads the registry on mount and auto-starts the upload — no second user
// click required.
//
// Using a module-scoped Map instead of React context because the drop/paste
// handler is wired through a Tiptap extension configure() call, not React.

const pendingUploads = new Map<string, File>()

export function registerPendingImageUpload(id: string, file: File): void {
  pendingUploads.set(id, file)
}

export function takePendingImageUpload(id: string): File | null {
  const file = pendingUploads.get(id)
  if (!file) return null
  pendingUploads.delete(id)
  return file
}

export function newPendingUploadId(): string {
  // Cheap unique id — used only for the short lifetime between drop and
  // upload-start. Collisions would require two drops within the same tick
  // which is fine to ignore.
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
