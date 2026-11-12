import { execSync } from 'node:child_process'

console.log('1/2 Compilando proyecto con Vite...')
execSync('npm run build', { stdio: 'inherit' })

console.log('2/2 Empaquetando dist/* en varado-html5.zip...')
const cmd = process.platform === 'win32'
  ? 'powershell -Command "Compress-Archive -Path dist/* -DestinationPath varado-html5.zip -Force"'
  : 'cd dist && zip -r ../varado-html5.zip ./*'
execSync(cmd, { stdio: 'inherit' })

console.log('Listo! El archivo varado-html5.zip esta actualizado y listo para subir a itch.io.')

