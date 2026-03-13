# Antigravity Multi-Agent Workflow Design

To execute the `implementation_plan.md` automatically, we can orchestrate a group of specialized Antigravity AI agents using the **Multi-Agent Orchestration Pattern**.

Each Agent operates asynchronously, picking up tickets from the PRD Backlog (in Linear) and pushing PRs to GitHub. 

## The Agent Roster

### 1. `Lead Architect` (Conductor Agent)
*   **Role:** The mastermind. Breaks down epics into actionable GitHub branches and Linear issues.
*   **Tools:** Linear MCP, GitHub Automation, Github Worktrees.
*   **Workflow:** Reads `prd_backlog.md`, creates a PR for each Epic containing the skeleton of the code, and delegates specific tickets to subordinate agents. Merges approved PRs and handles Git conflict resolution.

### 2. `Frontend / UX Engineer`
*   **Role:** Specializes in React, Next.js 16.1, Tailwind, and shadcn/ui.
*   **Skills Provided:** `frontend-dev-guidelines`, `react-nextjs-development`, `ui-ux-pro-max`, `web-artifacts-builder`.
*   **Workflow:** Takes the UI tickets (e.g., "Build the project creation modal"). Reads the DB schema to ensure form inputs match types. Generates responsive interfaces with loading skeletons. Uses `webapp-testing` tool / Playwright to verify the UI visually.

### 3. `Backend & Data Engineer`
*   **Role:** Specializes in Prisma, PostgreSQL, Fastify API routes, and Supabase MCP.
*   **Skills Provided:** `backend-dev-guidelines`, `postgres-best-practices`, `prisma-expert`, `auth-implementation-patterns`.
*   **Workflow:** Incorporates Supabase MCP to interact directly with the DB schema. Builds the Cloudflare tunnel routing for webhooks to `webhook.topstm.com`. 

### 4. `Queue & AI Worker Specialist`
*   **Role:** Focused on Node.js/Fastify background jobs with BullMQ, API retries, and AI models.
*   **Skills Provided:** `workflow-automation`, `llm-app-patterns`, `prompt-engineering`.
*   **Workflow:** Sets up the BullMQ queue. Implements Gemini CLI and OpenAI SDK API integrations. Calls `pinscrape-dl` CLI for assets. Ensures the data fits Zod schemas.

### 5. `Remotion Video Engineer`
*   **Role:** Heavily focused on the `remotion` engine and AWS Lambda rendering.
*   **Skills Provided:** `remotion-best-practices`, `react-patterns`.
*   **Workflow:** Installs the official `remotion-dev/skills` skill. Follows `@remotion/lambda` official documentation to render MP4 videos dynamically and passes webhook links back to the BullMQ jobs.

### 6. `QA & Testing Agent`
*   **Role:** Ensures the system doesn't break when integrated.
*   **Skills Provided:** `e2e-testing`, `playwright-skill`, `testing-patterns`, `find-bugs`.
*   **Workflow:** Runs in parallel on every open PR. Writes Jest coverage for the AI background workers (mocking the LLM responses to test Zod validation). Writes Playwright tests that simulate a user logging in, clicking "New Project", and navigating the State Machine phases.
*   **Loop:** If QA finds bugs, it adds comments to the PR using `address-github-comments` and pings the respective engineer agent to fix them before `Lead Architect` can merge.

---

## Execution Loop

1. **Lead Architect** sets up `/project-setup` branch, generates `schema.prisma`.
2. **Backend Engineer** merges DB setup & Fastify setup.
3. **Frontend Engineer** branches off `main` to build the Next.js 16.1 Dashboard and Setup Modals, pushing React components.
4. **Queue Specialist** concurrently branches to build the BullMQ + Redis AI workers.
5. **QA Agent** checks out `frontend` and `queue` PRs and writes tests against them.
6. Once merged, **Remotion Engineer** wires up the final Render pipeline.
7. **Lead Architect** runs a final integration build and notifies the human User that the MVP is ready for staging deployment via Vercel.
