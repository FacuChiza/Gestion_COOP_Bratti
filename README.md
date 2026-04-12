# 🏫 Sistema de Gestión de Pagos — Cooperadora Escolar

Sistema web de gestión de cuotas y pagos para cooperadoras escolares. Permite al personal administrativo controlar el estado de pagos de todos los alumnos, registrar cobros en efectivo y dar de alta nuevos estudiantes; mientras que las familias pueden consultar el estado de sus cuotas desde un portal propio con login.

---

## ✨ Funcionalidades principales

### Panel Administrativo (`/admin`)
- **Lista de alumnos** con estado de cuota del mes en curso (pagada, pendiente, vencida)
- **Registro de pagos en efectivo** con selección de cuotas, descuentos y notas
- **Alta de pagadores y alumnos** con creación automática de usuario para el portal de familias
- **Sistema de alertas** con listado de alumnos que acumulan 3 o más meses de deuda
- **Simulación del proceso mensual**: genera las cuotas del mes actual para todas las suscripciones activas y marca como vencidas las cuotas pendientes del mes anterior
- **Estadísticas rápidas** en tiempo real: alumnos activos, cuotas pagas, pendientes y en deuda

### Portal de Familias (`/cuenta`)
- **Login seguro** con email y contraseña (Supabase Auth)
- **Dashboard personal** con tarjetas por alumno mostrando el estado del mes, monto adeudado y historial de los últimos pagos
- **Alerta de deuda total** cuando hay cuotas sin pagar
- Acceso **protegido**: redirige automáticamente si no hay sesión activa

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 14** (App Router) |
| Base de datos y Auth | **Supabase** (PostgreSQL + Auth) |
| Estilos | **Tailwind CSS v3** |
| Componentes UI | **Radix UI** + **class-variance-authority** |
| Notificaciones | **Sonner** |
| Lenguaje | **TypeScript** |
| Deploy | **Vercel** |

---

## 🗄️ Modelo de datos

```
pagadores      → titulares que pagan, vinculados a un usuario de Auth
alumnos        → estudiantes, asociados a un pagador
planes         → planes de suscripción (mensual, anual, etc.)
suscripciones  → relación alumno ↔ plan
cuotas         → una fila por alumno por mes (pendiente / pagada / vencida)
pagos          → registro de cada cobro realizado
pagos_cuotas   → tabla puente entre un pago y las cuotas que cancela
configuracion  → parámetros globales (meses de alerta, descuento máximo, etc.)
```

---

## 🚀 Instalación y uso local

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/tu-repo.git
cd tu-repo
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiá el archivo de ejemplo y completá con tus datos de Supabase:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

ADMIN_USER=admin
ADMIN_PASSWORD=tu_contraseña_segura
```

### 4. Configurar la base de datos

En **Supabase → SQL Editor**, ejecutá los dos scripts incluidos en la carpeta `/supabase`:

1. `schema.sql` — crea todas las tablas y datos iniciales
2. `rls.sql` — aplica las políticas de Row Level Security

### 5. Correr en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el browser.

---

## 🔐 Seguridad

- El panel `/admin` está protegido con **HTTP Basic Auth** configurable por variables de entorno
- El portal `/cuenta` usa **Supabase Auth** con sesiones seguras via cookies (SSR)
- Las rutas del dashboard redirigen automáticamente si no hay sesión activa
- Las operaciones de escritura del admin usan la **service role key** del lado del servidor, nunca expuesta al cliente
- Las tablas tienen **Row Level Security (RLS)** activo: cada pagador solo puede ver sus propios datos

---

## 📁 Estructura del proyecto

```
app/
├── admin/
│   ├── page.tsx          # Panel principal (Server Component)
│   └── actions.ts        # Server Actions: listar, registrar pago, alta, cron
├── cuenta/
│   ├── page.tsx          # Login del portal de familias
│   ├── dashboard/
│   │   └── page.tsx      # Dashboard del pagador (Server Component)
│   └── actions.ts        # Login, logout, carga de datos
└── layout.tsx

components/
├── admin/
│   ├── AdminTabs.tsx         # Contenedor de tabs del panel
│   ├── StudentList.tsx       # Tabla de alumnos con búsqueda
│   ├── PaymentFormDialog.tsx # Modal de registro de pago
│   ├── AddPagadorDialog.tsx  # Modal de alta pagador/alumno
│   ├── AlertsSection.tsx     # Sección de alertas de deuda
│   └── CronButton.tsx        # Botón de proceso mensual
└── cuenta/
    ├── LoginForm.tsx          # Formulario de login
    └── StudentCard.tsx        # Tarjeta de estado por alumno

lib/supabase/
├── client.ts   # Cliente para componentes del browser
├── server.ts   # Cliente para Server Components y Actions
└── admin.ts    # Cliente con service role (operaciones admin)

supabase/
├── schema.sql  # Definición de tablas y datos iniciales
└── rls.sql     # Políticas de Row Level Security

middleware.ts   # Protección de rutas /admin y /cuenta/dashboard
```

---

## ☁️ Deploy en Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com)
2. Agregar las variables de entorno en **Settings → Environment Variables**
3. Vercel detecta Next.js automáticamente — no requiere configuración adicional

---

## 📄 Licencia

Este proyecto es de uso privado e institucional.

---

**Desarrollado por Facundo L. Chiarenza**
