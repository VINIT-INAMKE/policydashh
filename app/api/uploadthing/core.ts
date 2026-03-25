import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'

const f = createUploadthing()

/**
 * Uploadthing file router with image and document upload routes.
 *
 * Routes:
 * - imageUploader: accepts image/* up to 10MB, requires auth
 * - documentUploader: accepts PDF, DOCX, DOC, XLSX, PPTX up to 25MB, requires auth
 */
export const ourFileRouter = {
  imageUploader: f({
    image: { maxFileSize: '16MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, name: file.name }
    }),

  documentUploader: f({
    pdf: { maxFileSize: '32MB', maxFileCount: 1 },
    blob: { maxFileSize: '32MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, name: file.name }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
