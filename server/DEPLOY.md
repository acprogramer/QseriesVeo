# QseriesVeo - Backend Deployment Guide

## Desplegar en Render (Gratis)

### Pasos:

1. **Ve a [render.com](https://render.com) y crea una cuenta** (puedes usar GitHub)

2. **Crea un nuevo Web Service:**
   - Click en "New +" → "Web Service"
   - Conecta tu repositorio de GitHub

3. **Configura el servicio:**
   - **Name:** `qseriesveo-api`
   - **Region:** El más cercano a ti (ej: Oregon, US)
   - **Branch:** `main` o `master`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free

4. **Click en "Create Web Service"**

5. **Espera a que despliegue** (puede tomar 3-5 minutos)

6. **Copia la URL** que te da Render (ej: `https://qseriesveo-api.onrender.com`)

7. **Actualiza el frontend:**
   - Edita `client/.env.production` con la URL de tu API
   - Vuelve a hacer build y deploy a Firebase

### Notas importantes:

- ⚠️ **El plan free de Render se "duerme"** después de 15 minutos de inactividad
- La primera petición después de inactividad puede tomar 30-50 segundos
- Para mantenerlo activo, usa un servicio como [UptimeRobot](https://uptimerobot.com) para hacer pings cada 5 min

### Alternativas:

- **Railway.app** - Similar a Render, también tiene plan free
- **Fly.io** - $5/mes crédito gratis
- **Heroku** - Ya no tiene plan free
