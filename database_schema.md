# Database Schema Recommendation

Based on the MVP specifications of Video Worker Studio, a relational schema (PostgreSQL) managed by Prisma is recommended. This provides strict typing for our Next.js backend and handles the hierarchical nature of video projects.

## Prisma Schema Draft

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @unique
  name      String?
  avatarUrl String?
  
  projects  Project[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ----------------------------------------------------------------------------
// Core Domain: Project
// Represents a single video being created.
// ----------------------------------------------------------------------------

enum ProjectStatus {
  DRAFT               // Initial prompt entered, waiting for Idea Enhancement
  IDEA_READY          // Idea + Title options generated
  STRUCTURE_DRAFT     // User selected title, waiting for scenes
  ASSETS_READY        // Scenes and initial assets generated
  RENDERING           // Actively rendering
  COMPLETED           // MP4 is ready
  FAILED              // Error state
}

model Project {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String        @db.Uuid
  user           User          @relation(fields: [userId], references: [id])
  
  status         ProjectStatus @default(DRAFT)
  
  // Inputs
  initialPrompt  String        @db.Text
  aspectRatio    String        @default("9:16") // e.g., "9:16", "1:1", "16:9"
  targetDuration Int           @default(30)     // Target duration in seconds
  
  // Selected Data (after Idea Phase)
  selectedTitle  String?       @db.VarChar(255)
  topic          String?       @db.VarChar(255)
  persona        String?       @db.VarChar(100)
  
  // Final Result
  finalVideoUrl  String?       @db.Text
  
  // Relations
  scenes         Scene[]       // Has exactly 4-6 scenes based on user request
  ideas          IdeaOption[]  // Pre-generated ideas for the user to choose from
  jobs           JobRecord[]   // Background job audit logs

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

// ----------------------------------------------------------------------------
// Ideas / Titles (Idea Phase)
// The LLM generates 3-5 of these per project.
// ----------------------------------------------------------------------------

model IdeaOption {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId   String   @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  title       String   @db.VarChar(255)
  hook        String   @db.Text
  rationale   String   @db.Text
  
  selected    Boolean  @default(false)
  
  createdAt   DateTime @default(now())
}

// ----------------------------------------------------------------------------
// Scenes (Structure Phase)
// Defines the timeline of the video. 
// ----------------------------------------------------------------------------

model Scene {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId      String    @db.Uuid
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  sequenceOrder  Int       // Defines timeline order (1, 2, 3...)
  durationSecs   Float     // How long this scene lasts
  
  // Content Requirements
  visualPrompt   String    @db.Text // What the asset should depict
  captionText    String    @db.Text // Text overlay on the video
  ttsText        String?   @db.Text // Voiceover text (optional)
  
  // Render Config
  transitionIn   String?   @db.VarChar(50) // e.g. "fade", "slide-left"
  kenBurnsEffect String?   @db.VarChar(50) // e.g. "zoom-in", "pan-right"
  
  // Assets
  assets         Asset[]   
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([projectId, sequenceOrder]) // Prevent sequence duplication in a project
}

// ----------------------------------------------------------------------------
// Assets
// The actual media files (images, videos, audio) attached to a scene.
// ----------------------------------------------------------------------------

enum AssetType {
  IMAGE
  VIDEO
  AUDIO_VOICEOVER
  AUDIO_MUSIC
}

enum AssetSource {
  PINTEREST
  PEXELS
  ELEVENLABS
  USER_UPLOAD
}

model Asset {
  id             String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sceneId        String      @db.Uuid
  scene          Scene       @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  
  type           AssetType
  source         AssetSource
  
  sourceUrl      String?     @db.Text // Original external URL
  localUrl       String?     @db.Text // Cached/downloaded S3/Storage URL
  
  // For images / video
  altText        String?     @db.Text
  authorName     String?     @db.VarChar(255) // For attribution 
  
  isSelected     Boolean     @default(true)   // If false, it's an alternate option

  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

// ----------------------------------------------------------------------------
// Job Records (Audit & Retry handling)
// Tracks background worker processing states.
// ----------------------------------------------------------------------------

enum JobType {
  GENERATE_IDEAS
  GENERATE_SCENES
  FETCH_ASSETS
  RENDER_VIDEO
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model JobRecord {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId   String    @db.Uuid
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  jobType     JobType
  status      JobStatus @default(PENDING)
  
  // For idempotency / observability
  workerId    String?   @db.VarChar(255)
  payload     Json?     // What we sent to the LLM/Worker
  result      Json?     // What it returned
  error       String?   @db.Text
  
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
}
```

## Key Architectural Decisions in this Schema:
1. **Strong Separation of Progress:** The `ProjectStatus` enum strongly dictates where in the funnel the user is. UI components can mount based purely on this enum.
2. **Auditability:** `JobRecord` tracks all interactions with external agents (LLMs, Pinterest wrappers). If a render fails, we can check the `JobRecord` to read the exact error.
3. **Draft/Alternate Options:** `IdeaOption` and `Asset.isSelected` allow the LLM to generate alternate options, and the frontend to display them for the user without destructively overwriting data until the user explicitly selects one.
