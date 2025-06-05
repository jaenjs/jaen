import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
//unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.js

export const generatePdfCover = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({scale: 2})
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({canvasContext: context, viewport}).promise

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
    }, 'image/png')
  })
}
