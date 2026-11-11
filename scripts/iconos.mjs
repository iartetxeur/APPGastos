// Genera los iconos PNG de la PWA a partir del SVG. Uso: node scripts/iconos.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icons/favicon.svg')
const barras = `
  <rect x="116" y="290" width="64" height="106" rx="14" fill="#99f6e4"/>
  <rect x="224" y="212" width="64" height="184" rx="14" fill="#5eead4"/>
  <rect x="332" y="116" width="64" height="280" rx="14" fill="#ffffff"/>`
// Versiones a sangre completa (sin esquinas) para iOS y para el icono "maskable" de Android
const pleno = (escala) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0f766e"/>` +
  `<g transform="translate(256 256) scale(${escala}) translate(-256 -256)">${barras}</g></svg>`)

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile('public/icons/icon-512.png')
await sharp(pleno(0.72), { density: 300 }).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
await sharp(pleno(0.9), { density: 300 }).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
console.log('Iconos generados')
