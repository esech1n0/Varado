import os
import zipfile

zip_path = 'varado-html5.zip'
dist_dir = 'dist'

if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk(dist_dir):
        # Sort files to ensure deterministic zip order
        dirs.sort()
        files.sort()
        for file in files:
            full = os.path.join(root, file)
            # CRITICAL: Always use forward slash '/' for Linux web servers (itch.io)
            rel = os.path.relpath(full, dist_dir).replace('\\', '/')
            z.write(full, rel)
            print(f'  + {rel}')

print(f'\nListo: {zip_path} creado con rutas estandar (forward slash).')
