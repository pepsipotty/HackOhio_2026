const base = import.meta.env.BASE_URL

export const gifSrc = (id: string): string => `${base}media/gifs/${id}.gif`
export const DEMO_VIDEO = `${base}media/video/demo.mp4`
export const DEMO_POSTER = `${base}media/video/demo-poster.jpg`
export const MODEL_URL = `${base}models/human.glb`
