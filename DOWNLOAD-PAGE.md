# Página de Descarga — SofLIA Hub

Guía para implementar la sección de descarga en SofLIA Learning.

---

## URLs de descarga (GitHub Releases)

Los instaladores se publican automáticamente en:

```
https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases
```

### Links directos (siempre apuntan a la última versión)

**Windows:**
```
https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/latest/download/SofLIA.Hub-Windows-Setup.exe
```

**macOS:**
```
https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/latest/download/SofLIA.Hub-Mac-Installer.dmg
```

> **Nota:** Los links con `/latest/download/` redirigen automáticamente al release más reciente. Sin embargo, los nombres de archivo incluyen la versión (ej: `SofLIA.Hub-Windows-0.0.3-Setup.exe`), por lo que los links genéricos no funcionarán directamente. Usa la API para obtener los links reales (ver abajo).

### Links por versión específica

```
https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/download/v0.0.3/SofLIA.Hub-Windows-0.0.3-Setup.exe
https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/download/v0.0.3/SofLIA.Hub-Mac-0.0.3-Installer.dmg
```

---

## API para obtener la última versión dinámicamente

Usa la API pública de GitHub (no requiere autenticación):

```
GET https://api.github.com/repos/DevOps-043/PulseHub-SofLIA-releases/releases/latest
```

### Respuesta relevante:

```json
{
  "tag_name": "v0.0.3",
  "name": "SofLIA Hub v0.0.3",
  "body": "### Added\n- Build para macOS...",
  "assets": [
    {
      "name": "SofLIA.Hub-Windows-0.0.3-Setup.exe",
      "browser_download_url": "https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/download/v0.0.3/SofLIA.Hub-Windows-0.0.3-Setup.exe",
      "size": 107000000
    },
    {
      "name": "SofLIA.Hub-Mac-0.0.3-Installer.dmg",
      "browser_download_url": "https://github.com/DevOps-043/PulseHub-SofLIA-releases/releases/download/v0.0.3/SofLIA.Hub-Mac-0.0.3-Installer.dmg",
      "size": 95000000
    }
  ]
}
```

---

## Código de ejemplo para la página de descarga

### JavaScript — Obtener links dinámicamente

```javascript
const RELEASES_API = 'https://api.github.com/repos/DevOps-043/PulseHub-SofLIA-releases/releases/latest';

async function getLatestRelease() {
  const res = await fetch(RELEASES_API);
  const data = await res.json();

  const version = data.tag_name; // "v0.0.3"
  const releaseNotes = data.body;
  const publishedAt = data.published_at;

  const assets = {};
  for (const asset of data.assets) {
    if (asset.name.includes('Windows') && asset.name.endsWith('.exe')) {
      assets.windows = {
        url: asset.browser_download_url,
        size: (asset.size / 1024 / 1024).toFixed(1) + ' MB',
        name: asset.name,
      };
    }
    if (asset.name.includes('Mac') && asset.name.endsWith('.dmg')) {
      assets.mac = {
        url: asset.browser_download_url,
        size: (asset.size / 1024 / 1024).toFixed(1) + ' MB',
        name: asset.name,
      };
    }
  }

  return { version, releaseNotes, publishedAt, assets };
}
```

### React — Componente de descarga

```jsx
import { useState, useEffect } from 'react';

const RELEASES_API = 'https://api.github.com/repos/DevOps-043/PulseHub-SofLIA-releases/releases/latest';

export function DownloadSection() {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(RELEASES_API)
      .then(res => res.json())
      .then(data => {
        const assets = {};
        for (const asset of data.assets) {
          if (asset.name.includes('Windows') && asset.name.endsWith('.exe')) {
            assets.windows = {
              url: asset.browser_download_url,
              size: (asset.size / 1024 / 1024).toFixed(1) + ' MB',
            };
          }
          if (asset.name.includes('Mac') && asset.name.endsWith('.dmg')) {
            assets.mac = {
              url: asset.browser_download_url,
              size: (asset.size / 1024 / 1024).toFixed(1) + ' MB',
            };
          }
        }
        setRelease({
          version: data.tag_name,
          notes: data.body,
          date: new Date(data.published_at).toLocaleDateString('es-ES'),
          assets,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (!release) return <p>No se pudo obtener la información de descarga.</p>;

  return (
    <div>
      <h2>Descargar SofLIA Hub {release.version}</h2>
      <p>Publicado el {release.date}</p>

      <div style={{ display: 'flex', gap: '1rem', margin: '2rem 0' }}>
        {release.assets.windows && (
          <a href={release.assets.windows.url} download>
            <button>
              ⬇ Windows (.exe) — {release.assets.windows.size}
            </button>
          </a>
        )}
        {release.assets.mac && (
          <a href={release.assets.mac.url} download>
            <button>
              ⬇ macOS (.dmg) — {release.assets.mac.size}
            </button>
          </a>
        )}
      </div>

      {release.notes && (
        <details>
          <summary>Ver novedades</summary>
          <pre>{release.notes}</pre>
        </details>
      )}
    </div>
  );
}
```

### HTML estático (sin framework)

```html
<section id="download-section">
  <h2>Descargar SofLIA Hub</h2>
  <p id="version-text">Cargando versión...</p>

  <div id="download-buttons" style="display:flex; gap:1rem; margin:2rem 0;">
    <!-- Se llenan dinámicamente -->
  </div>

  <div id="release-notes"></div>
</section>

<script>
  fetch('https://api.github.com/repos/DevOps-043/PulseHub-SofLIA-releases/releases/latest')
    .then(r => r.json())
    .then(data => {
      document.getElementById('version-text').textContent =
        `SofLIA Hub ${data.tag_name} — ${new Date(data.published_at).toLocaleDateString('es-ES')}`;

      const container = document.getElementById('download-buttons');
      container.innerHTML = '';

      data.assets.forEach(asset => {
        if (asset.name.endsWith('.exe') || asset.name.endsWith('.dmg')) {
          const isWin = asset.name.includes('Windows');
          const size = (asset.size / 1024 / 1024).toFixed(1);
          const btn = document.createElement('a');
          btn.href = asset.browser_download_url;
          btn.innerHTML = `
            <button style="padding:12px 24px; font-size:16px; cursor:pointer; border-radius:8px; border:none; background:${isWin ? '#0078d4' : '#333'}; color:white;">
              ${isWin ? '⊞ Windows' : '⌘ macOS'} — ${size} MB
            </button>
          `;
          container.appendChild(btn);
        }
      });

      if (data.body) {
        document.getElementById('release-notes').innerHTML =
          `<h3>Novedades</h3><pre style="white-space:pre-wrap;">${data.body}</pre>`;
      }
    });
</script>
```

---

## Requisitos del sistema

| | Windows | macOS |
|---|---------|-------|
| **OS** | Windows 10+ (64-bit) | macOS 12 Monterey+ |
| **RAM** | 4 GB mínimo, 8 GB recomendado | 4 GB mínimo, 8 GB recomendado |
| **Disco** | ~300 MB | ~300 MB |
| **Red** | Conexión a internet requerida | Conexión a internet requerida |

---

## Instrucciones de instalación

### Windows
1. Descarga el archivo `.exe`
2. Ejecuta el instalador
3. Sigue el asistente de instalación (puedes elegir la carpeta)
4. SofLIA Hub se abrirá automáticamente al terminar

### macOS
1. Descarga el archivo `.dmg`
2. Abre el `.dmg` y arrastra SofLIA Hub a la carpeta Aplicaciones
3. La primera vez: clic derecho → Abrir (macOS puede bloquear apps no firmadas)
4. Inicia SofLIA Hub desde Aplicaciones

---

## Notas importantes

- **Auto-actualización:** Una vez instalado, SofLIA Hub se actualiza automáticamente. La página de descarga es solo para la primera instalación.
- **Rate limit de GitHub API:** La API pública permite 60 requests/hora por IP. Suficiente para una página de descarga. Si necesitas más, agrega un token en el header `Authorization: Bearer <token>`.
- **Cache:** Considera cachear la respuesta de la API por 5-10 minutos para no exceder el rate limit.
- **Linux:** De momento no se distribuye build para Linux. Si se necesita en el futuro, el pipeline ya soporta AppImage — solo hay que agregar un job `build-linux`.
