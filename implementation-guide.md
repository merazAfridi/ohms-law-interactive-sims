TenTen - Media Asset Repository

CM Guide — Adding Media Content to TenTen
A short, practical guide for the Content Management team. Read once, refer back when adding rows.


1. What this sheet does
Every row in the media_assets sheet describes one image or one simulation that TenTen can include in answers when it helps the student. When you click TenTen Media → Sync changed rows, your edits flow into the AI's database. From that moment on, TenTen can use your asset.

You do not need to do anything else — no tickets, no engineering. Edit, validate, sync.


2. One-time setup
Done by an admin (Uttam) once per Sheet:

Open the Sheet → Extensions → Apps Script → paste sync-sheet.gs → save.
Reload the Sheet. A TenTen Media menu appears.
TenTen Media → Configure API
API base URL: https://ai.10minuteschool.com (prod) or staging URL.
X-TENMS-SERVICE-KEY: paste the key (ask backend if you don't have it).
TenTen Media → Setup / repair headers — creates the columns.

After this, anyone with edit access can add rows and sync.


3. The columns — what to fill
Column
Required
What to write
sheet_row_id
leave blank
Auto-filled by the script the first time you sync. Never edit.
kind
yes
image, simulation, or video. Lowercase.
title
yes
Short human label. Example: Periodic Table — IUPAC 2024
description
yes
The most important field. Write what the asset shows AND when a student would benefit from it. Bilingual (Bangla + English) gives best matching. ≥20 characters.
keywords
yes
Comma-separated. Both Bangla AND English keywords. Example: periodic table, পর্যায় সারণি, elements, মৌল
grades
optional
Comma-separated. Example: Class 6,Class 7,Class 8,Class 9,Class 10,HSC. Blank = applies to all grades.
subjects
optional
Comma-separated. Example: chemistry,biology. Lowercase. Blank = all subjects.
topic
optional
Free-form, e.g. periodic-classification. Helps you, doesn't affect matching much.
cdn_url
yes
The image CDN link, simulation URL, video CDN link, or YouTube/Vimeo embed URL. Allowed hosts depend on kind — see Section 4.3.
thumbnail_url
required for videos; recommended for sims
Image used as the poster (videos) or the card preview (sims). Must come from cdn.10minuteschool.com or ddxm0wzmpjfn7.cloudfront.net.
render_hint
optional
JSON. Examples: {"iframe_height":600} for sims, {"aspect":"16/9","duration_seconds":92,"captions_url":"https://cdn.../captions.vtt","start":0} for videos. Leave blank otherwise.
asset_format
optional
static (default), gif, interactive, mp4, hls, youtube. Validator enforces kind ↔ format compatibility (see Section 4.3).
url_template
sims only — all three together
If the sim supports customization, write the exact template the AI may use, with {{param}} placeholders. Example: https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/#/simulator?z={{atomic_number}}
url_param_schema
sims only — all three together
JSON describing allowed params. Every {{param}} in url_template must appear here. Example: {"atomic_number":{"type":"int","min":1,"max":118,"aliases":["z","atomic_number","proton_number"]}}
url_build_instructions
sims only — all three together
Plain-language instructions for the AI. Example: If the student asks about a specific element, set atomic_number to that element's atomic number. If no element is mentioned, use the base simulator URL.
is_active
yes
TRUE (default) or FALSE. Set to FALSE to instantly hide a faulty asset from TenTen.
priority
optional
Integer. Higher wins ties. Default 0. Use sparingly.
meta
optional
JSON. Free-form notes, e.g. {"owner":"rifat","attribution":"NCTB"}.
local_hash / last_sync_status / last_sync_at
leave blank
Script manages these. Read-only for you.



4. How to write a good description (this is the lever)
TenTen matches student questions to your assets by reading the description. So write the description like a student asking for it, not like a textbook caption.

Bad:

"An image of the periodic table."

Good:

"Visual periodic table of all 118 elements with atomic number, mass, group, period. Use when a student asks about elements overview, group/period, electron configuration, or mentions পর্যায় সারণি / মৌল / IUPAC."

Rules of thumb:

One paragraph in Bangla, one short line in English in the same cell.
Mention the scenarios in which a student would want this asset.
Use the same words students use, not formal textbook terms only.
≥20 characters; ~2–4 sentences total is usually right.


4.1 If one asset applies to many grades or subjects
Do not duplicate the same row many times.

Instead:

put all applicable grades in the grades column, comma-separated
put all applicable subjects in the subjects column, comma-separated

Example:

For Chemistry Lab - Uttam, if it should work for Class 6 through HSC in chemistry:

grades = Class 6,Class 7,Class 8,Class 9,Class 10,HSC
subjects = chemistry

If a sim/image should work for all grades, leave grades blank. If it should work for all subjects, leave subjects blank.

This is important because the backend stores one asset once, then maps it to many grades/subjects internally. That keeps the AI fast and avoids duplicates.


4.1.1 Adding a GIF (animated image)
GIFs are just a flavor of kind=image — no new column, no new workflow.

Fill the row exactly like a static image, with one tweak:

Column
Value
kind
image
asset_format
gif
cdn_url
https://cdn.10minuteschool.com/...example.gif
description, keywords, grades, subjects, etc.
same as any image


How it renders:

TenTen embeds it as a normal markdown image. Web, Android, and iOS all natively animate GIFs in their image components.
The animation autoplays and loops automatically — that's how the GIF format works. There is no pause / mute / scrub control.

When to use GIF vs video: pick GIF only for short, soundless loops.

Use case
Best format
≤3 seconds, simple loop (e.g. wave on a string, electron orbiting)
GIF (kind=image, asset_format=gif)
3–10 seconds, simple loop, smallish file
GIF still fine
>10 seconds, or has narration / audio, or students should be able to pause/scrub
Video (kind=video, asset_format=mp4)
Anything that would be larger than ~2MB as a GIF
Video — a 5MB GIF is usually a 200KB MP4


Quality bar for GIFs:

≤3 seconds, ≤2MB. Anything longer or heavier should be converted to MP4 and added as kind=video instead.
Compress before upload (gifski, ezgif.com, ImageOptim). A bloated GIF ruins the answer on slow connections.
Test on a phone over 3G/4G. If it stalls or downloads visibly tile-by-tile, it's too big.
For long, narrated, or pause-worthy clips, don't use GIF — use a video row.


4.2 If a simulation supports customizable query params
Some simulations are not served by one fixed URL. The AI may need to customize the final URL before serving it.

Example:

Base simulator:

https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/#/simulator

Hydrogen-specific version:

https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/#/simulator?z=1

For these sims, fill all three fields:

url_template
url_param_schema
url_build_instructions

Example for Periodic Table Builder - Uttam:

url_template

https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/#/simulator?z={{atomic_number}}

url_param_schema

{"atomic_number":{"type":"int","min":1,"max":118,"aliases":["z","atomic_number","proton_number"]}}

url_build_instructions

If the student asks about a specific element, set atomic_number to that element's atomic number and build the final URL using the z query param. If no specific element is mentioned, use the base simulator URL without query params.

Important:

Only include params the sim actually supports.
Keep the instructions short and explicit.
If the sim does not support customization, leave these fields blank.


4.2.1 Sims must be mobile-first
The vast majority of TenTen students are on Android / iOS, often on small screens and weak networks. Build and approve every sim with mobile as the primary target, not desktop.

Before approving a sim (is_active=TRUE), open it on a real phone — not just a desktop browser tab — and verify:

Layout fits a 360–414px wide screen without horizontal scroll, pinch-zoom, or clipped controls.
Touch targets are ≥44×44px. No tiny click handles, no hover-only interactions.
Works in portrait orientation by default. If the sim genuinely needs landscape (rare), it should prompt the user to rotate, not just look broken.
Loads on 3G/4G in under ~5 seconds to first interactive frame. Heavy WebGL scenes need a loading state.
No external scrollbars. The sim's own canvas should not introduce a second scrollbar inside the chat WebView/iframe.
Text remains readable at default mobile zoom (no reliance on browser zoom).
Works inside an iframe / WebView, not just a standalone tab. Test by opening the sim URL inside a quick test iframe — many sims silently break under iframe sandboxing.
Survives device rotation without resetting state.
Doesn't depend on a mouse hover for any feature. Touch first.

If a sim fails any of these on mobile, leave is_active=FALSE and report it to the sim owner. A desktop-only sim is worse than no sim — students will tap it once, get a broken UI, and lose trust.


4.3 If the asset is a video
Video is supported as a first-class media kind. CM may not ingest videos in the May 10 batch, but the system is ready when you do.

When kind=video:

cdn_url must come from one of:
https://cdn.10minuteschool.com/
https://videos.10minuteschool.com/ (future video CDN)
https://www.youtube.com/embed/... or https://youtu.be/...
https://player.vimeo.com/video/...
thumbnail_url is required — it's used as the poster while the video is loading. Must come from cdn.10minuteschool.com or the existing CloudFront host.
asset_format must be one of mp4, hls, youtube. Use:
mp4 for direct .mp4 files on your CDN
hls for adaptive streams (.m3u8)
youtube for YouTube embeds (Vimeo also goes here for now)
render_hint strongly recommended for videos:
"duration_seconds": 92 — TenTen uses this to avoid suggesting long videos for short answers
"aspect": "16/9" — controls card aspect ratio
"captions_url": "https://cdn.../captions.vtt" — if you have captions, link them here
"start": 30 — start playing from 30s in (optional; reserved for future)

Sim-only fields stay blank for video rows: url_template, url_param_schema, url_build_instructions.

How videos play:

The card shows the thumbnail with title + duration. When it scrolls into view, it autoplays muted, looped, inline. The first tap unmutes it. This matches Instagram / TikTok / YouTube Shorts behavior.
On cellular or with reduced-motion accessibility settings, autoplay is disabled and the user has to tap Play.
For YouTube/Vimeo URLs, an iframe is used instead of native playback.

Quality bar:

Keep videos short — ideally 30s to 3 minutes. Long videos are rarely useful for chat-style explanations.
Always provide a clean thumbnail (don't let the OS generate a black frame).
If the video has dialogue / narration, captions are strongly preferred since autoplay is muted.


5. Adding a row — the workflow
Add a new row at the bottom (or anywhere — order doesn't matter).
Fill in kind, title, description, keywords, cdn_url, is_active=TRUE. Fill optional fields if you have them. For sims that support customization, also fill url_template, url_param_schema, and url_build_instructions.
TenTen Media → Validate sheet (no upload) — turns invalid rows red and explains the error in last_sync_status. Fix anything red before continuing.
TenTen Media → Sync changed rows — only your new/edited rows are sent. The script asks the server what's already in DB and skips unchanged rows automatically (this saves embedding cost).
Read the toast at the bottom of the screen and check last_sync_status for each row. Possible values:
created — row inserted into DB. ✅
updated_with_reembed — your text changed; AI re-learned the asset. ✅
updated_metadata_only — you only changed priority / is_active / similar. ✅ Cheap.
unchanged — nothing different from DB. No-op.
INVALID: … — row rejected. Fix and re-sync.
FAILED: … — server error. Show this to backend.
Done. TenTen will start using the asset immediately.


6. Editing or disabling an existing row
Different edits cost different things on the backend. The script and server figure this out automatically — you do not have to do anything special — but it helps to know:

You change
What happens
Cost
title, description, keywords, cdn_url, url_build_instructions
TenTen re-learns the asset (re-embed).
small OpenAI cost per row
grades, subjects, topic, thumbnail_url, render_hint, asset_format, url_template, url_param_schema, is_active, priority, meta
DB row updates, embedding stays.
free
Nothing actually changed
Skipped as unchanged.
free


Common actions:

Tweak title/description/keywords → edit, then Sync changed rows. Re-embedding is automatic.
Tweak grades/subjects → edit the comma-separated values, then Sync changed rows. No duplicate rows. No re-embedding.
Tweak sim URL config → edit url_template / url_param_schema / url_build_instructions together, then Sync changed rows. Note: editing url_build_instructions does re-embed (because it changes what the sim is "for").
Faulty asset (wrong info, broken link, etc.) → set is_active to FALSE, Sync changed rows. TenTen stops using it within seconds.
Re-enable later → set is_active back to TRUE and sync.
Do not delete rows. Use is_active=FALSE — preserves history and auditability.


7. Selective vs full sync
Menu item
When to use
Sync changed rows
Default. 99% of the time. Only sends edited rows.
Sync selected rows
You changed something but only want to push specific rows. Highlight them first.
Sync ALL rows
First-time bootstrap of a new sheet, or after a backend migration. Server still skips unchanged ones internally — safe but slower.
Pull DB checksums (compare)
Sanity check. Marks rows as in-sync / drift / missing-in-db. Useful if multiple people edited recently.
Validate sheet (no upload)
Pre-flight before a big sync. Doesn't talk to the server.



8. Common errors
Error in last_sync_status
What to do
INVALID: kind must be one of image/simulation/video
Fix the kind cell. Lowercase.
INVALID: cdn_url not in allowlist for kind=…
The allowed hosts differ per kind. For video, only the video CDN, YouTube embed, or Vimeo embed are allowed.
INVALID: thumbnail_url required for video (used as poster)
Add a poster image from cdn.10minuteschool.com.
INVALID: asset_format "…" is not valid for kind=…
Use a format that matches the kind. Image → static/gif. Sim → interactive. Video → mp4/hls/youtube.
INVALID: description required (≥20 chars; bilingual recommended)
Write a longer, bilingual description.
INVALID: keywords required
Add at least one comma-separated keyword.
INVALID: render_hint must be JSON object or blank
Fix the JSON or leave empty. Example: {"iframe_height":600}.
INVALID: asset_format must be one of static/gif/interactive
Fix or leave the cell blank.
INVALID: url_template / url_param_schema / url_build_instructions are sim-only
Clear those fields for image rows. They are only valid for kind=simulation.
INVALID: url_template required when other URL fields are set
Sim URL customization is "all three or none". Either fill all three or clear all three.
INVALID: url_template uses {{xxx}} but it is not declared in url_param_schema
Add a matching entry in url_param_schema, or remove that placeholder from the template.
INVALID: url_param_schema.<key>.type must be one of int/float/string/enum/bool
Fix the type field.
INVALID: url_template host not in allowlist
Use an approved host. Ask DevOps if a new host is needed.
INVALID: too many grades / subjects (max 30)
Trim to ≤30 entries. If genuinely needed for more, leave blank to mean "all".
BATCH-FAILED: HTTP 401: …
Service key wrong/expired. Re-run Configure API.
BATCH-FAILED: HTTP 5xx: …
Backend issue — show to engineering. Re-sync after fix.
FAILED: embedding error
OpenAI hiccup. Re-sync. If it persists, ping engineering.



9. Quality bar before publishing
Before flipping is_active=TRUE on a new asset, sanity check:

CDN URL opens in a browser and looks correct.
For sims: open the URL on a real phone (Android and iOS). Layout fits ≤414px wide, touch targets ≥44px, works in portrait, loads on 3G/4G in under ~5s, works inside an iframe/WebView, doesn't rely on hover. Mobile-first is mandatory — see Section 4.2.1.
For videos: does the video play with sound on? Is the duration reasonable (≤3min)? Is the thumbnail clean (not a black frame)?
description mentions both what it shows AND when to use it, in Bangla and English.
Keywords include at least 3 each in Bangla and English.
grades and subjects set correctly (unless truly grade/subject-agnostic).
Sim has a thumbnail_url. Video has a thumbnail_url (required).
If the sim supports customization, url_template, url_param_schema, and url_build_instructions are filled and tested.
For videos: render_hint.duration_seconds is set; if narrated, render_hint.captions_url is provided.

If unsure, leave is_active=FALSE and ask another CM member to review.


10. Launch scope — what we are working with now
Simulations
These are the simulations currently in scope:

Force & Motion Explorer
Cell Structure 3D Viewer
Periodic Table Builder - Uttam
https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/
Chemistry Lab - Uttam
https://service-3d-atomic-simulator-by-tenten-23594790708.us-west1.run.app/#/laboratory
Human Body Explorer - Uttam
https://service-3d-human-body-simulator-by-tenten-23594790708.us-west1.run.app/
Circuit Builder - Raied
Trigonometry Unit Circle
Acid-Base pH Simulator
Ray Optics: Lens & Mirror
Chemical Reaction Balancer
Projectile Motion Simulator
Human Heart Cardiac Cycle Animator

Important:

Simulations can be customizable using query params.
That means the AI may serve different final URLs for different students depending on the topic.
So for each customizable sim, please fill the URL customization fields carefully.
Reference links for inspiration / benchmarking
https://zperiod.app/
https://phet.colorado.edu/
Images
For images, please use the attached analysis link as the source of truth for what to collect.
We need 100 high-quality images before the May 10 launch.
Prioritize images that clearly explain core concepts and are likely to be reused across many student questions.
Videos
Videos are technically supported but not part of the May 10 launch.
Once we open video ingestion (engineering will flip a flag), the same sheet workflow applies — just set kind=video.
Until then, leave videos out of the sheet. The validator will reject kind=video rows during this phase.


11. Where to ask for help
Uttam is the POC

