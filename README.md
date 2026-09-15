<div align="center">

# 🛒 KiranaWala

### **Your local kirana store, online.**

<p>
  A full-stack grocery platform that connects <b>customers</b> with <b>local store owners</b> — with AI-powered shopping experiences built into the journey.
</p>

<p>
  <a href="https://github.com/Jyatin/KiranaWala"><img src="https://img.shields.io/badge/⭐%20Star%20Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="Star Repository"></a>
  <a href="https://github.com/Jyatin/KiranaWala/issues"><img src="https://img.shields.io/badge/Issues-Open-2ea44f?style=for-the-badge&logo=github" alt="Issues"></a>
  <a href="https://github.com/Jyatin/KiranaWala/pulls"><img src="https://img.shields.io/badge/Pull%20Requests-Welcome-8957e5?style=for-the-badge&logo=github" alt="Pull Requests"></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=flat-square&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="JWT">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
</p>

<br>

**Discover stores · Browse products · Shop locally · Manage inventory · Order online · Shop smarter with AI**

</div>

---

## ✨ The Idea

Traditional kirana stores are deeply connected to their local communities, but many still lack the digital infrastructure that larger marketplaces provide.

**KiranaWala is built around a simple idea:** bring local stores online without taking away the familiarity of the neighbourhood shopping experience.

The platform has two primary experiences:

| 🛍️ Customers | 🏪 Store Owners |
|---|---|
| Discover local stores | Register & manage stores |
| Browse products | Manage product inventory |
| Explore store-specific items | Manage incoming orders |
| Place grocery orders | Customize store profiles |
| Get a smoother shopping experience | Operate through a dedicated dashboard |

> **The long-term vision:** make local commerce as convenient digitally as it is in person.

---

## 🎯 What Makes KiranaWala Different?

### 🏘️ Local-first commerce

Instead of treating every grocery store as another listing in a giant marketplace, KiranaWala focuses on the relationship between **customers and their nearby stores**.

### 🤖 AI-assisted shopping

The project is evolving beyond a traditional e-commerce flow with an **AI shopping assistant** and **intent-based basket integration**.

The goal is simple: customers should eventually be able to express what they want naturally, while the system helps turn that intent into a useful shopping basket.

### ⚡ Built as a real full-stack system

KiranaWala is not just a frontend mockup. It includes:

- REST-style backend routes
- MongoDB data models
- JWT authentication
- Customer and store-owner workflows
- Inventory management foundations
- Order-management foundations
- Automated CI workflows
- Docker configuration
- Testing infrastructure

---

## 🧩 Feature Map

<details>
<summary><b>🛍️ Customer Experience</b></summary>

<br>

- Customer registration
- Customer authentication
- Browse local stores
- View products belonging to a store
- Place orders
- Customer-focused shopping interface
- AI-assisted shopping direction

</details>

<details>
<summary><b>🏪 Store Owner Experience</b></summary>

<br>

- Store-owner registration
- Store-owner login
- Store profile management
- Product management
- Inventory workflows
- Order management
- Dedicated dashboard

</details>

<details>
<summary><b>🤖 AI Shopping Experience</b></summary>

<br>

The repository includes ongoing work around:

- AI shopping assistant interactions
- Natural-language shopping intent
- Intent-to-basket conversion
- Smarter customer shopping workflows

</details>

<details>
<summary><b>🛡️ Engineering & Infrastructure</b></summary>

<br>

- JWT-based authentication
- MongoDB persistence
- Express.js API layer
- Automated linting
- GitHub Actions
- Docker / Docker Compose
- Test suite under `server/__tests__`

</details>

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │       Customer       │
                         │  Browse · Shop · Buy │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Frontend        │
                         │   HTML · CSS · JS    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Express / Node    │
                         │     REST API Layer   │
                         └──────┬─────────┬─────┘
                                │         │
                    ┌───────────┘         └────────────┐
                    ▼                                  ▼
          ┌─────────────────┐                 ┌─────────────────┐
          │   MongoDB       │                 │  JWT Auth       │
          │ Users · Stores  │                 │ Customer / Owner│
          │ Products · Data │                 └─────────────────┘
          └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AI Experience  │
                       │ Intent → Basket  │
                       └──────────────────┘

                         ┌──────────────────────┐
                         │     Store Owner      │
                         │ Inventory · Orders   │
                         └──────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Role |
|---|---|---|
| 🎨 Frontend | HTML, CSS, JavaScript | Customer & store-owner interfaces |
| ⚙️ Backend | Node.js | Server runtime |
| 🔌 API | Express.js | Application/API layer |
| 🗄️ Database | MongoDB | Persistent application data |
| 🔐 Authentication | JWT | Secure authentication flow |
| 📦 Package Manager | npm | Dependency management |
| 🧪 Testing | Project test suite | Backend testing |
| 🧹 Code Quality | ESLint | Static analysis & linting |
| 🔄 CI/CD | GitHub Actions | Automated checks |
| 🐳 Deployment | Docker / Docker Compose | Containerized development |

---

## 📂 Project Structure

```text
KiranaWala/
│
├── .github/
│   └── workflows/
│       ├── lint.yml
│       └── node.js.yml
│
├── public/
│   ├── css/
│   │   └── styles.css
│   ├── images/
│   │   └── auth/
│   │       └── store-background.jpg
│   ├── js/
│   │   ├── customer.js
│   │   ├── store-owner-dashboard.js
│   │   └── store-owner.js
│   ├── .dockerignore
│   └── Dockerfile
│
├── server/
│   ├── __tests__/
│   ├── models/
│   │   ├── product.js
│   │   ├── store.js
│   │   ├── storeOwner.js
│   │   └── user.js
│   ├── routes/
│   │   ├── customerRoutes.js
│   │   └── storeRoutes.js
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── eslint.config.mjs
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── views/
│   ├── customer/
│   ├── store-owner/
│   │   ├── dashboard.html
│   │   ├── login.html
│   │   └── register.html
│   └── index.html
│
├── .gitignore
├── docker-compose.yml
├── package-lock.json
├── package.json
└── README.md
```

---

## 🔌 API

### Customer

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/customer/register` | Register a customer |
| `POST` | `/api/customer/login` | Authenticate a customer |

### Store Owner

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/store/register` | Register a store owner |
| `POST` | `/api/store/login` | Authenticate a store owner |

> 🚧 The API surface is actively evolving as shopping, inventory, order-management and AI capabilities expand.

---

## 🚀 Getting Started

### 1. Prerequisites

Install:

- **Node.js** v14+
- **MongoDB**
- **npm**
- **Docker** *(optional)*

### 2. Clone

```bash
git clone https://github.com/Jyatin/KiranaWala.git
cd KiranaWala
```

### 3. Install dependencies

```bash
npm install
```

If you are working inside the server package as well, install its dependencies according to `server/package.json`.

### 4. Configure environment variables

Create a `.env` file for the server configuration:

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
PORT=3000
```

⚠️ **Never commit real secrets, database credentials, or `.env` files.**

### 5. Start the server

```bash
node server/server.js
```

Open:

```text
http://localhost:3000
```

---

## 🐳 Run with Docker

KiranaWala includes Docker configuration for containerized development.

```bash
docker compose up --build
```

Stop the containers:

```bash
docker compose down
```

---

## 🧪 Testing & Quality

The repository includes a backend test directory:

```text
server/__tests__/
```

GitHub Actions workflows are also included for automated project checks and linting.

Before opening a pull request, make sure to:

```bash
# Install dependencies
npm install

# Run the project's available scripts
npm test
npm run lint
```

> If a script is not available in your current package configuration, use the scripts defined in the relevant `package.json`.

---

## 🌱 Development Roadmap

### Shopping

- [ ] Richer product discovery
- [ ] Improved cart experience
- [ ] Complete order lifecycle
- [ ] Better local-store discovery

### Store Management

- [ ] Advanced inventory controls
- [ ] Better order dashboards
- [ ] Store analytics
- [ ] Improved product management

### AI

- [x] AI shopping assistant foundation
- [x] Intent-based basket integration
- [ ] Smarter shopping intent extraction
- [ ] Context-aware recommendations
- [ ] Personalized shopping assistance

### Engineering

- [ ] Expand automated test coverage
- [ ] Improve API documentation
- [ ] Strengthen observability
- [ ] Improve deployment workflows

---

## 🤝 Contributing

Contributions, ideas and improvements are welcome.

### Contribution workflow

```bash
# Fork the repository, then clone your fork
git clone https://github.com/YOUR_USERNAME/KiranaWala.git
cd KiranaWala

# Create a feature branch
git checkout -b feature/your-feature

# Make your changes

# Commit
git add .
git commit -m "feat: describe your change"

# Push
git push origin feature/your-feature
```

Then open a **Pull Request** and explain:

- What changed
- Why it was needed
- How you tested it
- Any screenshots or API examples that help reviewers

### 💡 Good first contributions

- UI improvements
- Test coverage
- API documentation
- Bug fixes
- Accessibility improvements
- Performance improvements
- Developer experience improvements

---

## 📌 Current Development

KiranaWala is actively being developed with a focus on making local grocery shopping **simpler for customers and more powerful for store owners**.

Recent development includes work on the **AI shopping assistant** and **intent-based basket integration**, while the underlying customer, store, inventory and ordering architecture continues to grow.

---

## 👨‍💻 Author

<div align="center">

### Jyatin Singh

<a href="https://github.com/Jyatin">GitHub</a> ·
<a href="https://www.linkedin.com/in/jyatin-singh-88984831b/">LinkedIn</a> ·
<a href="mailto:singhjyatin@gmail.com">Email</a>

</div>

---

## ⭐ Support the Project

If you like the idea behind KiranaWala, consider giving the repository a **⭐ star** and sharing feedback through **Issues** or **Pull Requests**.

<div align="center">

<a href="https://github.com/Jyatin/KiranaWala">⭐ Star KiranaWala</a> ·
<a href="https://github.com/Jyatin/KiranaWala/issues">🐛 Report an Issue</a> ·
<a href="https://github.com/Jyatin/KiranaWala/pulls">🚀 Contribute</a>

</div>

---

<div align="center">

**Built with ❤️ for better local commerce.**

`KiranaWala` · Local stores, connected digitally.

</div>
