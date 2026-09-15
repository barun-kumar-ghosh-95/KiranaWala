# 🛒 KiranaWala

### **A modern online grocery platform connecting local kirana stores with customers**

<p align="center">
  <strong>Discover • Shop • Manage • Grow</strong>
</p>

<p align="center">
  A full-stack grocery management system built to bring the convenience of online shopping to local stores.
</p>

<p align="center">
  <a href="https://github.com/Jyatin/KiranaWala"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub"></a>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/JWT-Authentication-000000?style=for-the-badge&logo=jsonwebtokens" alt="JWT">
</p>

---

## ✨ What is KiranaWala?

**KiranaWala** is a full-stack web application designed around a simple idea: **local grocery stores should be able to participate in online commerce without losing the convenience and familiarity of the traditional kirana experience.**

The platform connects two sides of the ecosystem:

- 🛍️ **Customers** can discover stores, browse products, and place grocery orders online.
- 🏪 **Store owners** can manage their stores, maintain inventory, and handle incoming orders from a dedicated workflow.

The project is being developed as a practical full-stack system with a focus on authentication, inventory, order management, and a better digital shopping experience.

---

## 🚀 Core Features

### 🛍️ Customer Experience

- Secure customer registration and login
- Browse available local stores
- View store-specific products
- Explore grocery inventory before ordering
- Place orders through the platform
- Customer-focused shopping flow

### 🏪 Store Owner Experience

- Store owner registration and authentication
- Store profile management
- Product and inventory management
- Order management
- Dedicated store-owner dashboard
- Store-specific product workflows

### 🤖 AI-Powered Shopping Assistant

KiranaWala is also evolving toward an AI-assisted shopping experience, including intent-based basket interactions designed to make grocery shopping more natural.

The project repository currently includes recent development around an **AI shopping assistant** and **AI intent basket integration**.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Authentication | JWT |
| Package Manager | npm |
| Testing | Project test suite under `server/__tests__` |
| Code Quality | ESLint / GitHub Actions |
| Containerization | Docker / Docker Compose |

---

## 📁 Project Structure

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

## 🔌 API Endpoints

### Customer Routes

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/customer/register` | Register a new customer |
| `POST` | `/api/customer/login` | Authenticate a customer |

### Store Routes

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/store/register` | Register a new store owner |
| `POST` | `/api/store/login` | Authenticate a store owner |

> More endpoints can be added as customer shopping, inventory, and ordering flows continue to evolve.

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v14 or higher
- [MongoDB](https://www.mongodb.com/)
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Jyatin/KiranaWala.git
cd KiranaWala
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
PORT=3000
```

### 4. Start the application

```bash
node server/server.js
```

The application will be available at:

```text
http://localhost:3000
```

---

## 🐳 Docker

KiranaWala includes Docker configuration for containerized development and deployment workflows.

With Docker Compose available, you can start the project using:

```bash
docker compose up --build
```

Stop the services with:

```bash
docker compose down
```

> Make sure your environment variables and database configuration are appropriate for your deployment setup.

---

## 🧪 Testing & Code Quality

The project contains a dedicated test directory under:

```text
server/__tests__/
```

For development, run the available npm scripts defined in the relevant `package.json` files.

The repository also includes GitHub Actions workflows for automated checks, including linting and Node.js-related CI tasks.

---

## 🛠️ Development Workflow

KiranaWala is actively evolving. The current development direction includes:

- improving the customer shopping experience
- expanding store management capabilities
- strengthening inventory workflows
- improving order processing
- developing AI-assisted grocery interactions
- refining the overall full-stack architecture

This makes the repository suitable for experimenting with real-world full-stack patterns while continuously adding product functionality.

---

## 🤝 Contributing

Contributions are welcome.

### Contribution flow

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/AmazingFeature
```

3. Make your changes and test them locally.
4. Commit your changes:

```bash
git add .
git commit -m "Add some AmazingFeature"
```

5. Push your branch:

```bash
git push origin feature/AmazingFeature
```

6. Open a Pull Request with a clear description of the changes.

### Good contribution practices

- Keep changes focused and reviewable.
- Follow the existing project structure.
- Do not commit secrets or `.env` credentials.
- Add or update tests when appropriate.
- Explain significant architectural or API changes in the PR description.

---

## 🗺️ Roadmap

The roadmap is intentionally flexible as development continues, but the project is moving toward:

- [ ] richer customer shopping flows
- [ ] stronger product discovery
- [ ] expanded cart and ordering capabilities
- [ ] deeper inventory management
- [ ] enhanced store-owner tools
- [ ] more capable AI shopping assistance
- [ ] improved test coverage
- [ ] stronger deployment and observability workflows

---

## 👨‍💻 Author

**Jyatin Singh**

- GitHub: [@Jyatin](https://github.com/Jyatin)
- LinkedIn: [Jyatin Singh](https://www.linkedin.com/in/jyatin-singh-88984831b/)
- Email: [singhjyatin@gmail.com](mailto:singhjyatin@gmail.com)

---

## 🔗 Project Links

- **Repository:** https://github.com/Jyatin/KiranaWala

---

## 📄 License

A license is not currently specified in the repository. Add a `LICENSE` file when you are ready to define how others may use, modify, and distribute the project.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Jyatin">Jyatin Singh</a>
</p>
