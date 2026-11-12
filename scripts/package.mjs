import { execSync } from 'node:child_process'

console.log('1/2 Compilando proyecto con Vite...')
execSync('npm run build', { stdio: 'inherit' })

console.log('2/2 Empaquetando dist/ en varado-html5.zip con rutas estandar (Linux/itch.io)...')
execSync('python scripts/zip.py', { stdio: 'inherit' })

console.log('¡Completado! varado-html5.zip esta listo para subir a itch.io.')
