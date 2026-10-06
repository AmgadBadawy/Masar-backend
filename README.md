# Masar Backend

> Backend & Content Management System for **مسار (Masar)** — an Arabic-first platform for simplifying government procedures in Egypt.

<p align="center">
  <strong>Strapi 5 • PostgreSQL • REST API</strong>
</p>

<p align="center">
  <a href="https://masar-frontend-ten.vercel.app/">Live Demo</a>
  ·
  <a href="https://github.com/AmgadBadawy/masar-frontend">Frontend</a>
  ·
  <a href="https://github.com/AmgadBadawy/Masar-backend">Backend</a>
</p>

---

## 📌 About Masar

**Masar (مسار)** is a full-stack Arabic-first web platform designed to make government services easier to discover and understand.

Instead of searching through scattered information, users can browse, search, filter, and explore structured government procedures through a simple RTL interface.

This repository contains the **backend and content management system** powering Masar.

---

## 🏗️ Full-Stack Architecture

```text
                         MASAR
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
     ┌─────────────────┐       ┌─────────────────┐
     │     Frontend    │       │     Backend     │
     │     Next.js     │◄─────►│     Strapi      │
     │     React       │ REST  │     REST API    │
     └─────────────────┘ API   └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │   PostgreSQL    │
                               │    Database     │
                               └─────────────────┘
```

### Repositories

| Part     | Technology                   | Repository                                                      |
| -------- | ---------------------------- | --------------------------------------------------------------- |
| Frontend | Next.js / React / TypeScript | [Masar Frontend](https://github.com/AmgadBadawy/masar-frontend) |
| Backend  | Strapi / Node.js             | [Masar Backend](https://github.com/AmgadBadawy/Masar-backend)   |
| Database | PostgreSQL                   | Managed separately                                              |

---

## ⚙️ Backend Responsibilities

The backend provides the data and content-management layer for the Masar platform.

It is responsible for:

- Government services
- Service categories
- Service-category relationships
- Structured service information
- Content management through Strapi
- REST API endpoints
- Database persistence
- Backend validation and testing
- Service data importing

---

## 🧰 Tech Stack

### Core

- **Strapi 5.54.0**
- **Node.js 20+**
- **TypeScript 5**
- **REST API**

### Database

- **PostgreSQL**
- `pg` — PostgreSQL driver
- `better-sqlite3` — local SQLite support

### Strapi Plugins

- `@strapi/plugin-users-permissions`
- `@strapi/plugin-cloud`

### Development

- Node.js Test Runner
- TypeScript
- Strapi CLI

---

## 📦 Content Model

The backend currently manages the core Masar content through Strapi.

### Categories

Categories organize government services into logical groups.

```text
Category
   │
   ├── Service
   ├── Service
   ├── Service
   └── ...
```

### Services

Services represent individual government procedures and contain structured information used by the frontend.

Depending on the service, this can include information such as:

- Service name
- Description
- Category
- Required documents
- Steps
- Fees
- Processing information
- Additional service metadata

---

## 🔗 Relationships

The primary relationship is:

```text
Category
   │
   └────── 1 : N ──────► Services
```

Each service belongs to a category, while a category can contain multiple services.

This relationship powers features such as:

- Category filtering
- Service categorization
- Category information on service pages
- Structured API responses
- Service discovery

---

## 🔌 API & Frontend Communication

The Next.js frontend consumes data from the Strapi REST API.

```text
User
  │
  ▼
Next.js Frontend
  │
  │ HTTPS / REST
  ▼
Strapi Backend
  │
  ▼
PostgreSQL
```

The backend returns structured JSON data that is transformed and displayed by the frontend.

---

## 🚀 Local Development

### Requirements

- Node.js `>=20.0.0 <=26.x.x`
- npm
- PostgreSQL for PostgreSQL-based local development

### Clone

```bash
git clone https://github.com/AmgadBadawy/Masar-backend.git
cd Masar-backend
```

### Install dependencies

```bash
npm install
```

### Environment Variables

Create a local `.env` file according to the Strapi configuration.

Example:

```env
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=masar
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password

HOST=0.0.0.0
PORT=1337
```

Additional Strapi security variables may be required depending on the environment.

> Never commit `.env`, database credentials, API tokens, or Strapi secrets.

---

## ▶️ Running the Backend

### Development

```bash
npm run dev
```

or:

```bash
npm run develop
```

### Production

Build:

```bash
npm run build
```

Start:

```bash
npm start
```

The production start command also runs:

```bash
node scripts/ensure-uploads.js
```

before starting Strapi.

---

## 📜 Available Scripts

| Command                   | Purpose                   |
| ------------------------- | ------------------------- |
| `npm run dev`             | Start development server  |
| `npm run develop`         | Start development server  |
| `npm run build`           | Build Strapi              |
| `npm start`               | Start production server   |
| `npm run console`         | Open Strapi console       |
| `npm run strapi`          | Run Strapi CLI            |
| `npm run test`            | Run backend tests         |
| `npm run import:services` | Import service data       |
| `npm run deploy`          | Deploy through Strapi CLI |
| `npm run upgrade`         | Upgrade Strapi            |
| `npm run upgrade:dry`     | Preview Strapi upgrade    |

---

## 📥 Service Data Import

The project includes a dedicated import script:

```bash
npm run import:services
```

This allows service data to be imported into the Strapi backend.

---

## 🧪 Testing

Backend tests use Node.js's built-in test runner.

Run:

```bash
npm run test
```

---

## 🌐 Production

The backend is deployed independently from the frontend.

```text
Frontend
   │
   │ REST API
   ▼
Strapi Backend
   │
   ▼
PostgreSQL
```

### Production Backend

```text
https://masar-backend.amgedbadawy.blitz.cloud
```

### Production Frontend

```text
https://masar-frontend-ten.vercel.app/
```

The frontend communicates with the deployed Strapi instance through the configured API URL.

---

## 🛠️ Production Data Challenge

One of the most important backend challenges during deployment was preserving and validating relationships between services and categories.

The production dataset contains:

- **9 categories**
- **130 services**

After transferring the content, the service-category relationships were verified and repaired through the Strapi API.

This highlighted an important production lesson:

> Moving CMS records is not enough — relationships between records must also be validated.

---

## 🔐 Security

Sensitive configuration is kept outside the repository.

Never commit:

- Database passwords
- API tokens
- JWT secrets
- Strapi application keys
- Encryption keys
- `.env` files
- Production credentials

Recommended `.gitignore` entries:

```gitignore
.env
.env.*
!.env.example

node_modules/
.cache/
.tmp/
build/
dist/
```

---

## 📁 Project Structure

```text
Masar-backend/
│
├── config/
│
├── src/
│   └── api/
│       ├── category/
│       └── service/
│
├── scripts/
│   ├── ensure-uploads.js
│   └── import-services.js
│
├── tests/
│
├── public/
│
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## 🔮 Future Improvements

Potential improvements include:

- Advanced API filtering
- Improved search capabilities
- API caching
- Authentication enhancements
- User-specific favorites
- Service status tracking
- More detailed service metadata
- Automated integration tests
- Automated database backups
- Improved deployment workflows

---

## 🔗 Masar Project

### Frontend

**Next.js + React + TypeScript + Tailwind CSS**

[View Frontend Repository](https://github.com/AmgadBadawy/masar-frontend)

### Backend

**Strapi + PostgreSQL + REST API**

[View Backend Repository](https://github.com/AmgadBadawy/Masar-backend)

### Live Demo

[Open Masar](https://masar-frontend-ten.vercel.app/)

---

## 👨‍💻 Author

**Amgad Badawy**

Masar is a full-stack portfolio project focused on building a practical Arabic-first digital experience for discovering and understanding government services.
