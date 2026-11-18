# api-gateway

Punto de entrada único de **FarmToTable** (marketplace agrícola con microservicios orientados a eventos). El frontend solo conoce al gateway: valida el JWT una sola vez y reenvía cada petición al microservicio que corresponde.

- Puerto local: `4000` · Prefijo público: `/api`
- Tecnologías: Node.js 22, Express 5, TypeScript, `http-proxy-middleware`, `jsonwebtoken`, `express-rate-limit`, `prom-client`
- No tiene base de datos.

## Enrutamiento

| Prefijo público | Servicio destino | Variable de entorno |
|---|---|---|
| `/api/auth` | auth-service | `AUTH_SERVICE_URL` |
| `/api/producers` | producer-service | `PRODUCER_SERVICE_URL` |
| `/api/products` | catalog-service | `CATALOG_SERVICE_URL` |
| `/api/inventory` | inventory-service | `INVENTORY_SERVICE_URL` |
| `/api/pricing` | pricing-service | `PRICING_SERVICE_URL` |
| `/api/orders`, `/api/carts` | order-service | `ORDER_SERVICE_URL` |
| `/api/payments` | payment-service | `PAYMENT_SERVICE_URL` |
| `/api/deliveries` | logistics-service | `LOGISTICS_SERVICE_URL` |
| `/api/notifications` | notification-service | `NOTIFICATION_SERVICE_URL` |
| `/api/analytics` | analytics-service | `ANALYTICS_SERVICE_URL` |

Una ruta desconocida responde `404 { "error": "Ruta no encontrada en el gateway" }`.

## Endpoints propios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | `{ service: "api-gateway", status: "ok" }` |
| `GET` | `/metrics` | Métricas en formato Prometheus (peticiones, tiempos de respuesta, memoria) |

## Seguridad

- **Autenticación:** lee `Authorization: Bearer <token>`. Sin token la petición sigue como anónima (rutas públicas como el catálogo); con token verifica firma y expiración y exige `sub` y `role`. Si es inválido responde `401 { "error": "Token inválido o expirado" }`.
- **Identidad hacia los servicios:** borra las cabeceras `x-user-id`, `x-user-role` y `x-internal-token` que lleguen de fuera y agrega las suyas, junto con `INTERNAL_TOKEN`. Así nadie puede falsificar su identidad.
- **Rate limiting:** 300 peticiones por minuto por IP (responde `429`).
- **CORS:** `CORS_ORIGIN` acepta varios orígenes separados por coma y `*` como comodín (por ejemplo `https://farmtotable-frontend-phi.vercel.app,https://farmtotable-frontend-*-tomjara543-makers-projects.vercel.app`).

## Variables de entorno

Ver `.env.example`: `PORT`, `JWT_SECRET` (el mismo de auth-service), `INTERNAL_TOKEN`, `CORS_ORIGIN` y las diez URLs `*_SERVICE_URL`. No se suben credenciales: `.env` está en `.gitignore`.

## Instalación y ejecución

```bash
cp .env.example .env     # ajusta JWT_SECRET y las URLs
npm install
npm run dev              # desarrollo
npm run build && npm start
```

## Pruebas

```bash
npm test                 # 2 unitarias y 2 de integración
npm run test:coverage    # genera el reporte de cobertura en coverage/
```

## Despliegue

`Dockerfile` + `render.yaml` (Render) y `.github/workflows/ci.yml`: en cada push y pull request instala, compila y corre las pruebas con cobertura; en `main`, si pasan, dispara el deploy hook de Render (secreto `RENDER_DEPLOY_HOOK_URL`).
