# Daily Task Manager

## Project structure

- `frontend/`: React and Vite application
- `backend/`: Express API
- `backend/controllers/`: request handlers
- `backend/routes/`: API route definitions
- `backend/services/`: business logic and integrations
- `backend/middleware/`: Express middleware
- `frontend/src/components/`: reusable UI components
- `frontend/src/pages/`: page-level views
- `frontend/src/services/`: frontend API clients

## Run locally

Start the API:

```powershell
cd backend
node server.js
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

The API health check is available at `http://localhost:5000/api/health`. Add your Supabase URL and service-role key to `backend/.env` when configuring server-side Supabase access. Keep the service-role key private and never expose it through frontend environment variables.
