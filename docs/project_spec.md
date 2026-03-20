# Video worker studio — Product Specification (MVP → V1)

## 1. Project overview

**Product name:** Video worker studio  
**Tagline:** Virtual video worker who creates viral videos from a combination of stock photos, effects, captions, and voice-over.

## 2. Vision

Video worker studio is an AI-first SaaS web platform that lets a user create viral-style YouTube videos from a single text idea.

The system acts like a **virtual video worker**:
- interprets the user’s idea,
- improves it for virality and retention,
- generates a scene-by-scene structure,
- proposes a suitable editing template,
- finds all required assets for each scene,
- lets the user review and modify the video plan,
- renders the final video,
- returns a downloadable result.

The core promise is:

“Give one idea → get a ready-to-publish video draft with assets, captions, voice-over, and editing structure.”

---

## 3. Business problem

Creating YouTube videos of the “viral slideshow / comparison / listicle / evolution / side-by-side / celebrity facts” type is repetitive and time-consuming.

A creator typically needs to:
- come up with a good topic/title,
- structure the video,
- find suitable images or clips,
- write captions,
- add effects/transitions,
- produce voice-over,
- render the final result.

This workflow is highly manual even though the format is repetitive.

Video worker studio productizes this repetitive pipeline and automates it through AI agents plus deterministic rendering templates.

---

## 4. Product goals

### 4.1 Primary goals
- Reduce video creation time from hours to minutes.
- Turn a raw text idea into a structured, reviewable video draft.
- Standardize popular video formats using predefined templates.
- Improve probability of views/retention using AI-enhanced topic framing.
- Provide a simple web workflow for non-technical creators.

### 4.2 MVP goals
- Support a small set of high-performing video templates.
- Accept one prompt and generate a reviewable scene plan.
- Allow manual replacement/reordering of assets.
- Render a complete video with transitions + optional voice-over + optional music and optional captions.
- Support one predefined demo user.

### 4.3 Non-goals for MVP
- auto voice-over generation
- Multi-tenant billing and subscriptions.
- Team collaboration.
- Full social publishing automation.
- Advanced timeline editing similar to Premiere/CapCut.
- Full UGC avatar video generation.
- Mobile apps.

---

## 5. Core user problem solved

The user wants to create a visually engaging YouTube-style video without manually doing research, asset gathering, scripting, scene planning, and editing.

The platform should give the user:
- fast concept-to-video workflow,
- confidence in structure,
- control over assets and scene order,
- predictable video output through templates.

---

## 6. Primary users

### 6.1 MVP primary persona
**Solo content creator / channel owner**
- wants to produce many videos quickly,
- often creates slideshow/listicle/comparison formats,
- values speed over frame-perfect creative editing,
- wants good YouTube metadata,
- may not know editing software deeply.

### 6.2 Future personas
- YouTube automation agencies,
- faceless channel operators,
- media teams creating high volumes of templated content,
- affiliate marketers and SEO content creators.

---

## 7. Supported video archetypes

The platform should be template-first. Each template defines:
- scene layout,
- required asset count per scene,
- caption zones,
- transition logic,
- optional animation/effect rules.
<!-- optional voice-over synchronization strategy.-->

### 7.1 Template archetypes for MVP

#### A. Single image slideshow
Each scene contains:
- 1 image or short video clip,
- animated zoom/pan effect,
- caption overlay,
- transition to next scene.

**Use cases:**
- historical facts,
- top 10 compilations,
- storytelling,
- motivational lists,
- educational shorts.

#### B. Side-by-side comparison
Each scene contains:
- left asset,
- right asset,
- bottom caption or two labels,
- optional center separator styling,
- transition to next scene.

**Use cases:**
- then vs now,
- before vs after,
- celebrity and spouse,
- old product vs new product,
- person comparison.

#### C. Two-image identity/fact card
Each scene contains:
- main person/object image,
- secondary associated image,
- short text block,
- optional age/year labels,
- animated entry effect.

**Use cases:**
- celebrity + spouse,
- actor + role,
- person + net worth,
- person + younger self,
- famous couples.

<!---
#### D. Evolution timeline
Each scene contains:
- one year or era label,
- one or two assets,
- consistent timeline caption style,
- transition styled as chronological progression.

**Use cases:**
- historical evolution,
- fashion through decades,
- technology evolution,
- car model generations.

#### E. Compilation template
Each scene contains:
- image or clip,
- ranking number or headline,
- strong caption hook,
- repeated pattern across all scenes.

**Use cases:**
- “Top 7…”,
- “Most expensive…”,
- “5 facts about…”,
- “Best places…”.
-->
---

## 8. End-to-end user flow

### Step 1. Input idea
User provides:
- raw text idea,
- number of scenes,
- duration per scene in seconds,
- video aspect ratio (16:9 or 9:16),
- video quality (HD, full HD, 4K)

Optional later additions:
- video language,
- target audience,
- YouTube category,
- aspect ratio,
- desired tone.

### Step 2. AI improves idea for virality
AI agent analyzes and improves:
- topic framing,
- title options,
- hook quality,
- retention potential,
- probable search demand.

The agent checks popularity signals from:
- Google Trends,
- YouTube search/autocomplete,
- related search signals.

Output:
- refined idea,
- title variants,
- reasoning summary,
- suggested tags/topics.

### Step 3. User confirms final idea/title
User selects:
- final concept,
- final working title,
- optional target keywords.

### Step 4. AI generates scene structure
AI agent generates:
- scene-by-scene plan,
- caption per scene,
- SEO-optimized video description for Youtube,
- video tags for Youtube.

### Step 5. System suggests best video template
System recommends template(s) based on idea structure.
User can:
- accept recommendation,
- preview alternatives,
- manually choose a different template.

### Step 6. AI gathers assets
For each scene, the system finds assets from the internet.

Asset sourcing priority for MVP:
1. Pinterest
2. Additional public image/video sources (fallback to Tavily search API https://docs.tavily.com/documentation/api-reference/introduction)

For each scene the system should retrieve:
- multiple candidate assets per required slot (at least 3 options),
- preview thumbnails,
<!--- source metadata,
- ranking score based on relevance.-->

### Step 7. Preview & edit video plan
The user opens a preview page with:
- full scene list,
- selected assets per scene,
- alternative assets per slot (at least 2),
- captions (can edit),
<!-- voice-over settings,-->
- music choice,
- transition/effect configuration,
- ability to reorder scenes,
- ability to regenerate scene assets (with option to edit search query).

### Step 8. Render final video
After confirmation, the system renders the final video according to:
- selected aspect ratio,
- video quality,
- caption position/style,
- effects/transitions,
- music (optional),
- voice-over (optional).

### Step 9. Deliver result
User sees rendered outputs in their library with:
- status,
- preview,
- download option,
- project metadata with export option (title, description, tags).

---

## 9. Functional requirements

## 9.1 Authentication
### MVP
- login screen,
- one predefined demo user,
- session-based or token-based authentication,
- protected application routes.

### Future
- registration,
- forgot password,
- OAuth,
- subscription and billing.

---

## 9.2 Video library
Main application screen (dashboard).

Functions:
- list all user video projects,
- create new video project,
- show project status,
- open existing project,
- duplicate project,
- delete project,
- download project files (video, title, description, tags files).

Project statuses:
- Draft
- Idea Confirmed
- Structure Generated
- Assets Ready
- Awaiting User Review
- Ready for Render
- Rendering
- Rendered
- Failed

Displayed fields:
- thumbnail,
- project title,
- template type,
- last updated,
- duration,
- render status.

---

## 9.3 Create new project wizard

### Inputs
Required:
- idea prompt,
- number of scenes,
- duration per scene in seconds,
- video aspect ratio (16:9 or 9:16),
- video quality (HD, full HD, 4K)

Optional:
- language,
- target platform (YouTube Shorts / regular video),
- voice-over on/off,
- YouTube channel niche.

Validation:
- scene count must be within system limits (from 2 to 100),
- scene duration within min/max threshold (from 2 to 60 sec),
- total duration must not exceed render constraints for MVP (120 min).

---

## 9.4 Idea enhancement module

### Responsibilities
- rewrite user idea into a stronger, more clickable concept,
- generate title options,
- suggest metadata directions,
- estimate likely format fit.

### Inputs
- raw prompt,
- selected niche/language.

### Outputs
- refined concept,
- 3–5 title options,
- recommended template type,
- related tags/keywords,
- popularity evidence summary.

### Acceptance criteria
- user must be able to approve one title,
- user must be able to edit refined concept manually,
- chosen idea is persisted as canonical project brief.

---

## 9.5 Trend and keyword validation module

Purpose: support virality-oriented idea optimization.

### Inputs
- selected title
<!--- keywords,
- niche context.-->

### External checks
- Google Trends
<!-- YouTube search suggestions/autocomplete,
- optionally SEO signal aggregators in future.-->

### Outputs
- popularity scores,
- trend relevance notes,
- suggested keyword variations (SEO optimized for YouTube),
- suggested video description (SEO optimized for YouTube).

### Notes
For MVP, this may be implemented as a semi-structured signal gathering step rather than a perfect analytics engine.

---

## 9.6 Scene structure generation

### Responsibilities
Generate a full scene plan for the selected template.

Each scene should include:
- scene number,
- scene purpose,
- caption text,
- search intent or asset query,
<!-- optional voice-over line,
- optional timing notes,-->
- required asset slot definitions.

### Example scene schema
- Scene 1
  - hook text
  - layout type
  - asset slot A query
  - asset slot B query (if needed)
  - caption (if enabled)
  - transition recommendation

### Constraints
- structure must conform to selected template,
- total number of scenes must match input,
- text length must fit caption rules.

---
<!--
## 9.7 Template suggestion engine

### Responsibilities
- infer the best matching template from prompt semantics,
- rank suitable templates,
- explain why each template fits.

### Example mapping
- “then and now” → side-by-side comparison,
- “top 10 richest actors” → compilation template,
- “how Tesla changed over time” → evolution timeline,
- “celebrities and wives” → two-image identity/fact card.

### User actions
- accept template,
- switch template,
- preview layout definitions.
-->
---

## 9.8 Asset sourcing module

### Purpose
Collect all required visual assets for every scene and slot (at least 3 options for each slot).

### MVP source priority
- Pinterest as the main asset source.
- Fallback to Tavily search API https://docs.tavily.com/documentation/api-reference/introduction

### Future optional sources
- Pexels,
- Pixabay,
- Unsplash,
- user uploads,
- premium stock APIs.

### Functional requirements
For each scene/slot:
- build search query,
- fetch several candidates,
- save previews and source link,
- allow retry/regenerate search,
- allow manual candidate selection.

### Asset object fields
- asset_id,
- source_provider,
- source_url,
- preview_url,
- original_url,
- asset_type,
- width,
- height,
- license metadata if available,
- query used.

### Important product note
The system must clearly separate:
- sourced assets,
- selected assets,
- fallback candidates.

---

## 9.9 Preview and edit page

This is one of the most important screens.

### Requirements
The user must see the full video plan on one screen or in a highly navigable scene list.

For each scene, the user can:
- preview layout,
- see current selected assets,
- switch between alternatives,
- rerun asset search (which option to change search query),
- edit caption text,
- reorder scene position,
- delete scene,
- regenerate scene assets.

Global settings available on preview page:
- caption style,
- font preset,
- caption position,
- background music,
- voice-over enable/disable,
- transition style,
- random transitions on/off,
- global effects intensity,
- aspect ratio,
- output quality.

### Required editing controls
- drag-and-drop scene reorder,
- per-scene replace assets,
- per-scene change search query,
- per-scene caption edit.

---

## 9.10 Captions system

### Requirements
- captions are generated per scene,
- captions can be auto-generated and manually editable,
- captions must support template-specific placement,
- style presets must exist.

### MVP caption style options
- Minimal white subtitle,
- Bold viral caption,
- Bottom label strip,
- Split labels for side-by-side.

### Caption settings
- font preset (all available options from https://fonts.google.com),
- size,
- weight,
- alignment,
- animation in/out.

---

## 9.11 Voice-over module

### MVP requirements
- optional voice-over file uploaded by user (mp3 or wav file)
<!-- optional voice-over generation per scene,
- user can choose a voice preset,
- user can enable/disable VO globally,
- each scene may have its own voice-over line.

### Output requirements
- merged TTS audio track,
- synchronization aligned with scenes,
- fallback to caption-only video if VO disabled.

### Future
- multilingual voices,
- emotion/tone control,
- pacing control,
- auto-shortening VO to fit duration.-->

---

## 9.12 Background music module

### Requirements
- choose from preset tracks,
- optional no music,
- consistent track across full video in MVP.

### Future
- AI music generation,
- section-based music switching,
- mood matching.

---

## 9.13 Rendering engine

### Responsibilities
Create final video from structured data and selected assets.

### Input parameters
- template,
- scenes,
- assets,
- captions,
- voice-over (optiomnal),
- music (optiomnal),
- transitions,
- aspect ratio,
- quality settings.

### Output formats for MVP
- MP4,
- HD and Full HD,
- portrait and landscape aspect ratios (16:9 or 9:16).

### Effects for MVP
- Ken Burns / zoom-pan,
- fade,
- slide,
- blur transition,
- simple randomization.

### Caption positions
- bottom,
- top,
- center lower-third.

### Rendering requirements
- asynchronous job processing,
- progress state tracking,
- retry on failure,
- artifact cloud storage with downloadable URL.

---
<!--
## 9.14 Final delivery page

### Requirements
- show rendered video player,
- download button,
- rerender option,
- duplicate project option,
- return to library.

### Future
- export to YouTube,
- save template as reusable preset,
- version history.
-->
---

## 10. AI agent architecture

The system should be implemented as a set of specialized AI-driven workers orchestrated by an application backend.

## 10.1 Agent design principle
Use **small specialized agents** rather than one monolithic agent.

Benefits:
- easier debugging,
- predictable outputs,
- better prompt control (all prompts shoud be stored in configuration file),
- easier replacement of models/providers (models can be changed in configuration file),
- safer retries and validation.

## 10.2 Recommended agents

### Agent 1. Idea Enhancer Agent
**Input:** raw user prompt, target scene count, scene duration, niche/language.  
**Output:** refined idea, title options, keyword set, virality framing.

### Agent 2. Trend Validation Agent
**Input:** titles, description and tags.  
**Output:** popularity/trend evidence, ranked title suggestions, warnings.

### Agent 3. Video Structure Agent
**Input:** approved concept + chosen template.  
**Output:** scene plan, captions, asset search queries.

<!--### Agent 4. Template Recommender Agent
**Input:** approved concept.  
**Output:** ranked template suggestions with rationale.-->

### Agent 4. Asset Query Builder Agent
**Input:** scene description and template slot definitions.  
**Output:** optimized search queries for each scene slot.

<!--### Agent 5. Asset Selection/Ranking Agent
**Input:** raw fetched candidates from providers.  
**Output:** best candidate ranking, fallback candidates, metadata.-->

### Agent 5. SEO Metadata Agent
**Input:** approved title + scene structure.  
**Output:** description, tags, optional hashtags.

### Agent 6. Render Packaging Agent
**Input:** final user-approved project structure.  
**Output:** deterministic render manifest for rendering engine.

---

## 11. Orchestration approach for Claude Code / Antigravity / Cursor

The project should be structured so agentic implementation is easy to generate and maintain.

### 11.1 Recommended pattern
Use a hybrid architecture:
- deterministic backend services for storage, auth, rendering, assets search, job processing,
- AI agents only for planning, enrichment, selection, and text generation.

### 11.2 Why this matters
Do not let LLMs directly control the entire product state.
Instead:
- LLM produces structured JSON outputs,
- backend validates against schemas,
- validated data is persisted,
- deterministic services execute the result.

### 11.3 Core orchestration rules
- every agent has a strict JSON schema output,
- every important step has validation,
- every step is auditable and retryable,
- user approval gates exist before expensive operations.

### 11.4 Suggested orchestration stages
1. Project created
2. Idea enhancement job
3. SEO enhancement job
4. User confirmation gate
5. Structure generation
6. Asset sourcing job
7. User review gate
8. Render packaging job
9. Render job
10. Delivery

---

## 12. Suggested frontend screens

## 12.1 Login page
- email
- password
- sign in

## 12.2 Video library page (dashboard)
- create new video button
- list/grid of existing projects
- delete project
- status chips
- quick open

## 12.3 New project modal / page
- idea prompt textarea
- number of scenes
- duration per scene
- aspect ratio
- quality select
- create button

## 12.4 Idea confirmation page
- improved idea summary
- title options
- keyword suggestions
- confirm button
- edit manually button

## 12.5 Template selection page
- recommended template cards
- visual example of layout
- choose template button

## 12.6 Preview/edit page
- left panel: scene list
- main area: selected scene preview
- right panel: candidates/settings
- global config drawer
- refresh search action
- render button

## 12.7 Rendering state page
- progress bar
- current stage
- error/retry state

<!--## 12.8 Final result page
- video player
- download
- rerender
- back to library-->

---

## 13. Non-functional requirements

## 13.1 Performance
- idea enhancement should complete within acceptable interactive latency,
- asset sourcing may be async with visible progress

## 13.2 Reliability
- all key jobs retryable,
- failures visible to user,
- partial progress preserved.

## 13.3 Auditability
- every AI response stored in structured form,
- every user approval action logged,
- render manifests versioned.

## 13.4 Scalability
MVP is single-user demo-first, but architecture should not block:
- multi-user tenancy,
- queued rendering,
- object storage,
- subscription model.

## 13.5 Security
- authenticated routes only,
- secured media access,
- source URL sanitization,
- rate limiting,
- secret isolation for model APIs.

---

## 14. Validation rules

### Idea stage
- prompt must not be empty,
- scene count and duration must be compatible,
- refined title must be selected before proceeding.

### Structure stage
- scene count must exactly match project settings,
- every scene must have required slots defined.

### Asset stage
- every required slot must have a selected asset before render,
- selected assets must have accessible source or downloaded local copy.

### Render stage
- render cannot start without all mandatory assets,
- render settings must pass allowed presets.

---

## 15. Error handling strategy

### Common failure cases
- no good assets found,
- AI output invalid schema,
- rendering failed,
- external source timeout,
- TTS generation failed.

### UX requirements
- clear status message,
- retry action,
- preserve user edits,
- allow manual override where possible.

### Engineering requirements
- structured error codes,
- step-level retry,
- fallback logic,
- observability/logging.

---

## 16. MVP scope definition

## Included in MVP
- one predefined user,
- login,
- video library,
- new project flow,
- AI idea enhancement,
- title suggestion,
- SEO suggestions,
- template recommendation,
- scene generation,
- Pinterest-first asset sourcing,
- scene preview and manual replacement,
- caption style selection,
- optional voice-over upload,
- background music preset,
- render final MP4,
- download result.

## Excluded from MVP
- voice-over auto generation
- payments/subscriptions,
- public registration,
- collaborative editing,
- advanced timeline editor,
- YouTube publish integration,
- fine-grained brand kit management,
- user-uploaded custom templates,
- multiple workspace support.

---
<!--
## 17. Roadmap after MVP

### Phase 2
- public registration,
- Stripe subscriptions,
- multiple users,
- saved presets,
- multilingual generation,
- more asset sources,
- better SEO research.

### Phase 3
- YouTube direct publish,
- batch generation,
- agency/team workspaces,
- custom templates,
- analytics dashboard,
- A/B title testing,
- advanced voice controls.

### Phase 4
- full AI channel pipeline,
- auto-thumbnail generation,
- auto-comment/pinned comment generation,
- content calendar,
- agentic series production.
-->
---

## 18. Product principles

1. **Template-first, not timeline-first**  
   The product is optimized for rapid generation of repeatable viral formats.

2. **AI proposes, user confirms**  
   Expensive or risky steps should require user confirmation.

3. **Structured outputs over free text**  
   Agent outputs must be schema-based.

4. **Deterministic rendering**  
   Final rendering should be driven by manifest, not by another prompt.

5. **Fast iteration**  
   Replacing assets and rerendering must be easy.

---

## 19. Recommended next deliverables after this spec

1. System architecture specification  
2. Technical architecture and stack recommendation  
3. Database schema  
4. JSON schemas for all AI agents  
5. PRD backlog in epics and user stories in Linear  
6. Screen-by-screen UX specification  
7. Agentic implementation plan  
8. Multi-agent workflow design
