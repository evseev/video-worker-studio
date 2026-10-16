# Emma's Angle — 4-week content calendar (from 2026-10-19)

Evidence: vidIQ breakout data (last 3–6 months, channels under 200K subscribers), keyword research (US), and the
channel's own history (partners and parent/child formats outperform generic then-and-now 10–50×).
Every topic below maps to an autopilot format; `pairs` is the target count after photo verification.

## Why these topics

| Signal | Example (views, channel size) | What we take from it |
|---|---|---|
| Couples, real-life partners | "60 Hollywood Celebrities And Their Real-Life Partners" (474K, 462 subs); "55 Famous Hollywood Celebs and Their Real-Life Wives" (229K, 4K) | Our best format; keep 2/week |
| Parent ↔ child, split by gender | "100 Hollywood Moms & Their Sons" (880K, 1K subs); "60 Famous Hollywood Fathers and Their Beautiful Daughters" (834K, 10K) | Split "kids" into the four parent/child pairings |
| Living legends | "100+ Legendary Actors STILL ALIVE Today! (1970s–1990s)" (720K + 362K, 5.6K); "50+ Oldest Living Actors in 2026" (1.32M, 1K) | Then-now restricted to living people (pipeline already drops deceased) |
| Cast "X years later" | "The Goonies Cast (1985): Then & Now – 41 Years Later" (1.18M, 377 subs); "Street Fighter (1994)" (252K) | Then-now with a single film/series as the topic |
| TV stars & partners | "18 Iconic TV Stars & Their Real-Life Partners" (473K, 10K) | Couples format, TV cohort |
| Search demand | "celebrities then and now" 35K/mo (competition 21); "celebrity kids" 13.7K/mo (+21%); "hollywood actors and their partners" 4K/mo (competition 17) | Put these phrases in titles and first description line |

Avoid (audience complaints / policy risk): fake death claims, doctored thumbnails, "you won't believe how ugly" framing,
race-based couple lists with altered photos, anything about illness.

## Calendar (5 videos/week, publish 5 PM Eastern)

| Week | Day | Format | Pairs | Series | Topic (idea_text) |
|---|---|---|---|---|---|
| 1 | Mon | couples | 50 | Hollywood Couples | Handsome Hollywood actors of the 1990s and their real-life wives and partners |
| 1 | Tue | parent-child | 50 | Like Parent, Like Child | Famous Hollywood fathers and their daughters who look just like them |
| 1 | Wed | then-now | 50 | Still With Us | Legendary actors of the 1970s to 1990s who are still with us today |
| 1 | Thu | couples | 50 | Hollywood Couples | Hollywood couples who have been married for more than 30 years |
| 1 | Fri | then-now | 20 | Cast Reunion | The cast of The Goonies (1985) then and now |
| 2 | Mon | parent-child | 50 | Like Parent, Like Child | Hollywood mothers and their sons who share their famous looks |
| 2 | Tue | couples | 50 | Hollywood Couples | Beautiful actresses of the 1980s and their real-life husbands |
| 2 | Wed | then-now | 50 | Still With Us | The most beautiful actresses of the 1980s and 1990s, then and now |
| 2 | Thu | couples | 40 | Hollywood Couples | Iconic TV stars of the 80s and 90s and their real-life partners |
| 2 | Fri | mega | 120 | Hollywood Couples | 120 famous Hollywood couples, then and now (long compilation for TV viewers) |
| 3 | Mon | parent-child | 50 | Like Parent, Like Child | Famous Hollywood fathers and their sons who followed them into acting |
| 3 | Tue | couples | 50 | Hollywood Couples | Action movie stars and their real-life wives |
| 3 | Wed | then-now | 20 | Cast Reunion | The cast of Dirty Dancing (1987) then and now |
| 3 | Thu | couples | 50 | Hollywood Couples | Country music legends and their longtime partners |
| 3 | Fri | then-now | 50 | Still With Us | Hollywood heartthrobs of the 1970s and 1980s who are still with us |
| 4 | Mon | parent-child | 50 | Like Parent, Like Child | Hollywood mothers and their daughters who look like twins |
| 4 | Tue | couples | 50 | Hollywood Couples | Rock and pop stars of the 80s and their real-life wives |
| 4 | Wed | then-now | 20 | Cast Reunion | The cast of Back to the Future (1985) then and now |
| 4 | Thu | couples | 50 | Hollywood Couples | Hollywood couples who met on a movie set and are still together |
| 4 | Fri | parent-child | 100 | Like Parent, Like Child | 100 famous parents and their children, side by side (long compilation for TV viewers) |

Seed this into the backlog after the migration: `psql "$DATABASE_URL" -v channel_id=<channels.id> -f docs/autopilot/seed-backlog.sql`.

## Shorts (3 per long video, cut automatically)

Post one Short per day, 9 AM Eastern, linking to the long video as "related video". Shorts that pass 10K views
indicate a topic worth a long-form sequel.

## Weekly loop (what I run each Monday once the channel is connected to vidIQ / YouTube Analytics)

1. Pull last week's CTR, average view duration, 30-second retention, subscribers per 1K views per video.
2. Re-run niche outliers; promote any topic with breakout score > 50 into next week's backlog.
3. Retire a format after 4 videos below 50% of the channel median views.
4. Report subscribers and public watch hours against the 1,000 / 4,000 goal before 2027-02-01.
