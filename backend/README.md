# FLN Backend — Express + MongoDB API

Express + Mongoose + JWT authentication for the FLN National Super Admin Dashboard.

See the [root README](../README.md) for full project documentation.

## Quick start

```bash
cp .env.example .env
npm install
npm run seed:superadmin    # creates superadmin@fln.org / Welcome1!
npm run dev                # nodemon on port 5000
```

## Scripts

```bash
npm start                  # node src/server.js
npm run dev                # nodemon src/server.js
npm run seed:superadmin    # Provisions default superadmin
```

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/api/health` | — | Health check |
| `POST` | `/api/auth/login` | — | Login (email, password, role) |
| `GET`  | `/api/auth/me` | ✓ | Current user |

## Environment variables

| Variable | Default | Required |
|---|---|---|
| `PORT` | `5000` | no |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/fln_answerkey` | no |
| `JWT_SECRET` | — | **yes** (change in production) |
| `JWT_EXPIRES_IN` | `7d` | no |
| `CORS_ORIGIN` | `http://localhost:5173` | no |

## Data model

`User`:
```js
{
  firstName: String,
  lastName:  String,
  email:     String (unique, lowercase),
  phone:     String,
  password:  String  // bcrypt-hashed, select: false
  role:      "superadmin" | "admin" | "state_admin" |
             "district_admin" | "block_admin" | "school" |
             "teacher" | "volunteer",
  isActive:  Boolean,
  lastLoginAt: Date
}
```

## Default credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@fln.org` | `Welcome1!` |

> **⚠️ Change the JWT_SECRET in `.env` before any non-local deployment.**