# CIRQL — Real-Time Team Collaboration Platform

CIRQL is a full-stack real-time team collaboration application built using the MERN stack. It provides a centralized platform for teams to communicate, collaborate, and manage their workspaces.

## Features

### Authentication
- User registration and login
- JWT authentication
- Access and refresh token management
- HTTP-only refresh-token cookies
- Protected routes

### Workspaces and Channels
- Create and manage workspaces
- Public and private channels
- Workspace membership
- Channel access control

### Real-Time Messaging
- Real-time channel messaging
- Direct messaging
- Message editing and deletion
- Message replies
- Message reactions
- Typing indicators
- Online presence and custom status

### Collaboration
- File and image attachments
- Message search
- Read receipts
- Unread message counts
- User mentions
- Real-time notifications
- Notification preferences

### User Experience
- Responsive interface
- Light and dark themes
- Loading and error states
- Smooth animations
- Message formatting
- Lazy-loaded components

## Technology Stack

### Frontend
- React
- Vite
- Redux Toolkit
- React Router
- Tailwind CSS
- Axios
- Socket.IO Client
- Motion

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO
- JSON Web Tokens
- bcryptjs
- Zod

### Additional Technologies
- Cloudinary
- Multer
- Redis (optional)
- Vitest
- Supertest
- MongoDB Memory Server

## Project Structure

```text
CIRQL/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── styles/
│   ├── package.json
│   └── .env.example
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   ├── utils/
│   │   └── server.js
│   ├── tests/
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Prerequisites

Before running CIRQL, install:

- Node.js
- npm
- MongoDB
- Cloudinary account for file uploads
- Redis (optional)

## Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd CIRQL
```

### 1. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file inside the server directory using `.env.example`.

Configure the following variables:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27017/cirql

CLIENT_URL=http://localhost:5173

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

REDIS_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Use strong, unique secrets outside development.

### 2. Frontend Setup

```bash
cd ../client
npm install
```

Create a `.env` file inside the client directory using `.env.example`.

Configure:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Running the Application

### Start Backend

Open a terminal:

```bash
cd server
npm run dev
```

Backend runs at:

`http://localhost:5000`

### Start Frontend

Open another terminal:

```bash
cd client
npm run dev
```

Frontend runs at:

`http://localhost:5173`

### Backend Health Check

`http://localhost:5000/api/health`

## Testing

### Run All Backend Tests

```bash
cd server
npm test
```

### Run Unit Tests

```bash
npm run test:unit
```

### Run Integration Tests

```bash
npm run test:integration
```

### Frontend Lint

```bash
cd client
npm run lint
```

### Production Build

```bash
npm run build
```

## Environment Variables

### Backend

| Variable | Description |
|---|---|
| PORT | Backend server port |
| NODE_ENV | Application environment |
| MONGODB_URI | MongoDB connection string |
| CLIENT_URL | Frontend URL allowed by CORS |
| JWT_ACCESS_SECRET | Access token signing secret |
| JWT_REFRESH_SECRET | Refresh token signing secret |
| REDIS_URL | Optional Redis connection |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary API secret |

### Frontend

| Variable | Description |
|---|---|
| VITE_API_URL | Backend API URL including `/api` |
| VITE_SOCKET_URL | Backend origin for Socket.IO |

**Security:** Never commit real `.env` files, API keys, database credentials, or JWT secrets to GitHub.

## File Uploads

CIRQL supports image and document attachments through Cloudinary.

- Maximum individual file size: 10 MB
- Supported formats include images, PDF, text, Word, and Excel documents.
- Cloudinary credentials are required for uploads.

## Deployment Checklist

Before deploying:

1. Configure a production MongoDB database.
2. Generate strong, unique JWT secrets.
3. Configure Cloudinary credentials.
4. Set `CLIENT_URL` to the production frontend origin.
5. Set `VITE_API_URL` to the production backend API URL.
6. Set `VITE_SOCKET_URL` to the production backend origin.
7. Configure HTTPS.
8. Verify refresh-token cookie behavior across frontend and backend domains.
9. Run backend tests and frontend production builds.
10. Verify API health and Socket.IO connectivity.

For separate frontend and backend domains, review cookie `SameSite` and `Secure` settings before deployment.

## Project Verification

Latest local verification:

- Backend automated tests: **88 passing**
- Frontend ESLint: **Passed**
- Frontend production build: **Passed**
- Backend health check: **Passed**
- MongoDB connectivity: **Verified**
- Frontend HTTP response: **200**
- Production deployment: **Not yet verified**

  
👨‍💻 Author

    ABHISEK MISHRA🤗

- LinkedIn: https://www.linkedin.com/in/abhisek-mishraaa

- GitHub: https://github.com/Abhisek-desk
