# Contributing to my-company-llm

Thanks for your interest in contributing! This project is in **beta** and we welcome all kinds of help -- bug reports, feature requests, documentation improvements, and code contributions.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/taha-can/my-company-llm.git
   cd my-company-llm
   ```
3. Set up the development environment:
   ```bash
   # Backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt

   # Frontend
   cd frontend
   npm install
   ```
4. Copy the environment file and add your API keys:
   ```bash
   cp .env.example .env
   ```
5. Start both servers:
   ```bash
   # Terminal 1 — Backend
   uvicorn backend.main:app --reload --port 8000

   # Terminal 2 — Frontend
   cd frontend
   npm run dev
   ```

## Project Structure

| Directory | What it does |
|-----------|-------------|
| `backend/api/` | REST and WebSocket endpoints |
| `backend/engine/` | Agent runner, router, memory (LangGraph + ChromaDB) |
| `backend/tools/` | Integration tools (Gmail, Twitter, LinkedIn, etc.) |
| `backend/db/` | SQLAlchemy models and database setup |
| `backend/models/` | Pydantic request/response schemas |
| `frontend/src/app/` | Next.js pages (App Router) |
| `frontend/src/components/` | React components |
| `frontend/src/lib/` | API client, auth, utilities |
| `frontend/content/docs/` | Documentation (MDX) |

## How to Contribute

### Bug Reports

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Python version, Node version)
- Any error messages or logs

### Feature Requests

Open an issue describing:
- What you'd like to see
- Why it would be useful
- Any ideas on implementation (optional)

### Code Contributions

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your changes
3. Test locally -- make sure both backend and frontend still work
4. Commit with a clear message:
   ```bash
   git commit -m "Add support for Slack notifications"
   ```
5. Push and open a Pull Request:
   ```bash
   git push origin feature/my-feature
   ```

### What to Work On

Good areas for contributions:

- **New integrations** — Add tools in `backend/tools/` (e.g., Notion, Jira, GitHub)
- **Agent capabilities** — Improve the agent runner or add new tool types
- **UI improvements** — Better components, mobile responsiveness, accessibility
- **Documentation** — Fix typos, add examples, improve guides in `frontend/content/docs/`
- **Tests** — We need more test coverage across backend and frontend
- **Bug fixes** — Check the issues tab for reported bugs

## Code Style

### Backend (Python)
- Follow PEP 8
- Use type hints
- Use async/await for database and HTTP operations
- Keep endpoint handlers thin -- put logic in the engine or tools layer

### Frontend (TypeScript)
- Use TypeScript strictly (no `any` unless absolutely necessary)
- Components go in `src/components/`, grouped by feature
- Use shadcn/ui components when possible
- Follow the existing Tailwind class ordering

## Pull Request Guidelines

- Keep PRs focused -- one feature or fix per PR
- Include a clear description of what changed and why
- If it's a UI change, include a screenshot
- Make sure the app runs without errors locally before submitting

## Questions?

Open an issue or start a discussion. We're happy to help you get started.
