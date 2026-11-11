# APPGastos

App personal para controlar gastos, ingresos, presupuestos e inversiones. Es una PWA: se instala desde el navegador en Android, iPhone, Windows y Linux, y los datos se guardan solo en el dispositivo.

## Uso en el ordenador

```bash
npm install
npm run dev        # desarrollo
npm test           # pruebas de la lógica
npm run build      # versión final en dist/
npm run preview    # servir la versión final
```

## Publicar (para instalarla en el móvil)

El flujo `.github/workflows/pages.yml` compila y publica en GitHub Pages en cada subida a `main`.

1. Crea un repositorio vacío en GitHub (público, salvo que tengas plan de pago).
2. En el repositorio: Settings → Pages → Source: **GitHub Actions**.
3. Sube el código:
   ```bash
   git remote add origin https://github.com/USUARIO/REPOSITORIO.git
   git push -u origin main
   ```
4. La app queda en `https://USUARIO.github.io/REPOSITORIO/`. Ábrela en el móvil e instálala desde el menú del navegador.

Los datos nunca se suben: cada dispositivo guarda los suyos. Para pasarlos de uno a otro usa Más → Ajustes → Exportar / Importar copia.
