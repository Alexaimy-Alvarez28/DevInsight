# DevInsight — GitHub Developer Analytics Dashboard

DevInsight es una aplicación web full stack que permite explorar perfiles y repositorios públicos de GitHub, analizar estadísticas de desarrollo y guardar información de interés en una base de datos PostgreSQL.

## Funcionalidades

- Búsqueda de desarrolladores de GitHub.
- Consulta de perfiles y repositorios públicos.
- Visualización de estadísticas de repositorios.
- Análisis de lenguajes de programación mediante gráficas.
- Comparación de perfiles de desarrolladores.
- Almacenamiento de perfiles y repositorios favoritos en PostgreSQL.
- Interfaz adaptable a diferentes tamaños de pantalla.

## Tecnologías utilizadas

**Frontend**
- React
- JavaScript
- HTML5
- CSS3
- Vite
- Recharts

**Backend**
- Node.js
- Express
- API REST
- Fetch API

**Base de datos**
- PostgreSQL
- pgAdmin 4

**API externa**
- GitHub REST API

## Estructura del proyecto

```text
DevInsight/
├── backend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── schema.sql
├── frontend/
│   ├── src/
│   ├── package.json
│   └── index.html
└── README.md
```

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/DevInsight.git
cd DevInsight
```

### 2. Configurar PostgreSQL

Crear una base de datos llamada `portafolio_react` y ejecutar el archivo `backend/schema.sql`.

### 3. Configurar las variables de entorno

Crear el archivo `backend/.env` a partir de `backend/.env.example` y configurar la conexión a PostgreSQL.

```env
DATABASE_URL=postgresql://postgres:TU_CONTRASENA@localhost:5432/portafolio_react
PORT=4000
CLIENT_ORIGIN=http://localhost:5174
```

### 4. Ejecutar el backend

```bash
cd backend
npm install
npm run dev
```

### 5. Ejecutar el frontend

Desde otra terminal, ubicada en la carpeta principal:

```bash
cd frontend
npm install
npm run dev -- --port 5174
```

Abrir `http://localhost:5174` en el navegador.

## Objetivo del proyecto

Demostrar habilidades en desarrollo full stack, integración de APIs REST externas, procesamiento de información JSON, visualización de datos y persistencia mediante PostgreSQL.

## Estado del proyecto

En desarrollo y pruebas locales.

## Autor

Desarrollado como proyecto de portafolio profesional.