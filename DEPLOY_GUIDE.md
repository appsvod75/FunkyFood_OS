# Guía de Despliegue en VPS (FunkyFood OS)

Sigue estos pasos para poner tu aplicación en producción en tu VPS.

## 1. Preparación del VPS
Asegúrate de tener acceso SSH a tu servidor.

### Instalar Node.js y MySQL
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (Versión 18 o superior)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar MySQL Server
sudo apt install -y mysql-server
```

## 2. Configuración de Base de Datos
1. Accede a MySQL:
   ```bash
   sudo mysql
   ```
2. Crea la base de datos y usuario:
   ```sql
   CREATE DATABASE funkyfood_os;
   CREATE USER 'funkyfood'@'localhost' IDENTIFIED BY 'TuPasswordSeguro';
   GRANT ALL PRIVILEGES ON funkyfood_os.* TO 'funkyfood'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```
3. Importar el esquema:
   Sube el archivo `database_schema.sql` al VPS y ejecútalo:
   ```bash
   mysql -u funkyfood -p funkyfood_os < database_schema.sql
   ```

## 3. Configuración del Backend
1. Sube la carpeta `server` al VPS (por ejemplo a `/var/www/funkyfood-os/server`).
2. Instala dependencias:
   ```bash
   cd /var/www/funkyfood-os/server
   npm install
   ```
3. Configura las variables de entorno:
   Crea un archivo `.env` basado en `.env.example`:
   ```bash
   nano .env
   ```
   *Asegúrate de poner el usuario y contraseña de MySQL que creaste.*
4. Inicia el servidor con PM2 (para que no se apague):
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name "restaurant-api"
   pm2 save
   pm2 startup
   ```

## 4. Configuración del Frontend (PWA)
1. En tu computadora local (donde tienes el código), construye la aplicación:
   *Asegúrate de que `VITE_API_URL` apunte a tu dominio del VPS (ej: https://api.tudominio.com/api)*.
   ```bash
   export VITE_API_URL="https://tu-vps-ip-o-dominio.com/api"
   export VITE_SOCKET_URL="https://tu-vps-ip-o-dominio.com"
   npm run build
   ```
2. Sube el contenido de la carpeta `dist` al VPS (ej: `/var/www/funkyfood-os/client`).

## 5. Configuración de Nginx (Proxy Inverso)
Instala Nginx si no lo tienes: `sudo apt install nginx`.

Crea un archivo de configuración: `sudo nano /etc/nginx/sites-available/funkyfood`

```nginx
server {
    listen 80;
    server_name tu-dominio.com; # O la IP de tu VPS

    # Frontend (Archivos estáticos y PWA)
    location / {
        root /var/www/funkyfood-os/client;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Activa el sitio:
```bash
sudo ln -s /etc/nginx/sites-available/funkyfood /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

¡Listo! Ahora tu aplicación debería estar accesible y funcionando con base de datos real.
