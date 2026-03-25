import { generateReactHelpers } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'

/**
 * Typed Uploadthing React helpers.
 *
 * useUploadThing - React hook for file uploads with progress tracking
 * uploadFiles - Imperative upload function for non-React contexts
 */
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>()
