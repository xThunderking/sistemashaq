# Control de equipos HAQ

Aplicación para registrar, consultar, editar y eliminar equipos por número de serie, área y dirección IP. El frontend se despliega en Netlify y la API usa funciones de Netlify para acceder a Amazon Aurora MySQL mediante RDS Data API.

## Desarrollo local

1. Instala Node.js 20 o superior y ejecuta `npm install`.
2. Copia `.env.example` como `.env` y coloca los ARN y región reales.
3. Crea la base de datos ejecutando `database/schema.sql` en Aurora MySQL.
4. Para probar sólo la interfaz, usa `npm run dev`. Para probar también las funciones, ejecuta `npx netlify-cli dev` y abre `http://localhost:8888`.

La identidad de AWS usada localmente debe tener permisos `rds-data:ExecuteStatement` y `secretsmanager:GetSecretValue` sobre el clúster y secreto configurados.

## Configuración de AWS

- Usa un clúster Amazon Aurora MySQL compatible con RDS Data API y activa **HTTP endpoint / Data API**.
- Guarda las credenciales del clúster en AWS Secrets Manager.
- Descarga el certificado global de Amazon RDS y conecta con verificación TLS:

  ```bash
  curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  mysql -h sistemashaq.ce52g4cuedb1.us-east-1.rds.amazonaws.com -P 3306 -u admin -p --ssl-mode=VERIFY_IDENTITY --ssl-ca=./global-bundle.pem
  ```

- Ya dentro de MySQL, ejecuta `source database/schema.sql;` desde la raíz del proyecto. También puedes pasarlo directamente agregando `< database/schema.sql` al comando de conexión.
- Crea un usuario IAM para Netlify con el permiso mínimo mostrado en `aws/netlify-policy.json` y genera una access key.

## Variables en Netlify

En **Site configuration → Environment variables**, agrega:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AURORA_RESOURCE_ARN`
- `AURORA_SECRET_ARN`
- `AURORA_DATABASE` (`sistemashaq`)

Nunca expongas estas variables con prefijo `VITE_`: eso las enviaría al navegador.

## Despliegue

Conecta el repositorio en Netlify. `netlify.toml` ya define `npm run build`, la carpeta `dist` y las funciones. Después de configurar las variables, publica el sitio.

## Seguridad recomendada

Antes de usar datos sensibles en producción, protege el sitio con autenticación y limita quién puede modificar el inventario. La API ya valida entradas, usa parámetros SQL y mantiene las credenciales únicamente en el servidor.
