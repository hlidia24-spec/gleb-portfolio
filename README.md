# Gleb Diadiurenko — Portfolio Website + Admin Studio (V3)

A dark, modern, English/Norwegian portfolio with an optional **secure content manager**. All original content, photos, interactive project details and tool pop-ups are preserved.

## What's new

- `admin.html` / `admin.css` / `admin.js` — password-based editor for projects, photo galleries, both-language text, tool descriptions, contact links and profile images.
- `cms-config.js` — contains two **public** Supabase project settings (initially empty).
- `cms-public.js` — fetches published edits; if not configured or unavailable, the original website remains visible.
- `default-data.js` — initial content used to prefill the editor with Gleb's five projects and five gallery pictures.
- `supabase-setup.sql` — enables a secure database and photo storage with Row Level Security.
- `ADMIN-SETUP.md` — **read this to activate your login and uploads**.
- All existing website features remain available: EN/NO, tool showcase dialogs, project carousels, lightbox, navigation and responsive styling.

## Preview the website

Unzip and open `index.html`. The portfolio runs even without an account or server. The **admin login needs additional setup** because a static GitHub Pages website cannot safely store a password or accept uploaded files by itself.

## Set up admin and publish

Read **[`ADMIN-SETUP.md`](ADMIN-SETUP.md)** for a step-by-step guide. You'll create your own Supabase project and login, run `supabase-setup.sql` after inserting your Supabase auth user UID, fill your **public** URL and key in `cms-config.js`, and upload the folder contents to GitHub Pages.

The admin panel will then be available at **`https://YOUR-WEBSITE/admin.html`** and from the discreet **ADMIN** link in the portfolio footer. Select **Save & publish** to publish edits. After initial setup, you won't need to edit code when adding projects, photos or text.

## Files overview

- `index.html`, `style.css`, `script.js`: existing public website
- `cms-public.js`, `cms-config.js`: optional live content loading
- `admin.html`, `admin.css`, `admin.js`: editing dashboard
- `default-data.js`: original portfolio content preloaded into the editor
- `supabase-setup.sql`, `ADMIN-SETUP.md`: security configuration and guide
- `assets/`: Gleb's optimized portfolio pictures, artwork and local tool icon illustrations

## Important safety notes

Keep your password, Supabase database password and Supabase secret/service keys **private**. Only the project's public **publishable / anon** key should appear in the website. Auth and database Row Level Security enforce the editor's access restrictions. Published images, contact information and project details are public to all website visitors. Don't upload anything private or without permission.

This website is an original implementation inspired by the reference website's broad structure, with Gleb's own information and dark visual identity.
