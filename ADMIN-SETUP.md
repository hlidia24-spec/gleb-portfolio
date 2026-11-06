# Set up your portfolio admin panel

Your new website includes **`admin.html`**, a real login and editing interface for adding projects, uploading photos, editing existing projects, updating EN/NO translations and replacing portraits. It is designed for **GitHub Pages** (static hosting), with **Supabase** providing the account login, database and image storage.

**Important:** A secure public login with uploads cannot run on plain GitHub Pages alone. You must connect Supabase once before the admin can save changes. It will show a setup screen until you do. The regular portfolio still works even before setup.

## Step 1 — Create a Supabase project

1. Go to [Supabase](https://supabase.com/) and make an account (use a strong password and account security settings).
2. Create a new Supabase project. Save the database password somewhere private; it is **not** the password you enter in your portfolio.
3. Wait for the project to finish provisioning.

Supabase has plan limits that can change; check its [current plans](https://supabase.com/pricing). Your website and the basic admin interface do not require your own paid server.

## Step 2 — Create your admin login

1. In the Supabase project, open **Authentication → Users**.
2. Use **Add user** to create your one admin account with **your email and a strong password**. If you use an invite email, follow its confirmation steps. Do **not** send your password to anyone.
3. Open the new user record and copy the **User UID** (a UUID such as `12345678-1234-1234-1234-123456789abc`). This is **not** your email or password.
4. Under **Authentication → Providers → Email** or the relevant signup settings, disable public/new account signups if you only want one admin.

## Step 3 — Enable the database and storage safely

1. Open the included file **`supabase-setup.sql`** in a text editor.
2. Replace **every** occurrence of `PASTE_YOUR_USER_UUID_HERE` with **your own Supabase user UID**.
3. In Supabase, open **SQL Editor**, paste the edited SQL and choose **Run**.
4. You should then have the `portfolio_data` database table and a public `portfolio-media` Storage bucket. The SQL applies Row Level Security rules that allow public reading but only **your authenticated account** to save content and upload images.

**Don't use an unrestricted database policy.** The login screen alone does not protect the database; the SQL restrictions are necessary.

## Step 4 — Connect your website

1. In Supabase, go to **Project Settings → API** (some layouts call it **Connect / API Keys**).
2. Copy your **Project URL** (like `https://example.supabase.co`) and **publishable key** (usually starts with `sb_publishable_`; some projects use a legacy `anon` public key).
3. Open **`cms-config.js`** inside the website folder, and fill in these two values:

```javascript
window.GLEB_CMS_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_KEY',
  bucket: 'portfolio-media'
};
```

**Never put a `service_role`, secret key, database password or admin login password in this file.** Publishable keys are intended for client-side sites because RLS protects the database and storage.

## Step 5 — Publish the website

Upload **all the contents of the `gleb-portfolio` folder** to the root of your GitHub repository (including `admin.html`, `admin.css`, `admin.js`, `cms-public.js`, `cms-config.js`, `default-data.js`, all images, `index.html`, `script.js`, and `style.css`).

If you haven't published before, go to your GitHub repository **Settings → Pages**, select **Deploy from a branch**, then `main` and `/ (root)`.

Open `https://YOUR-GITHUB-PAGES-ADDRESS/admin.html` (for example `https://username.github.io/gleb-portfolio/admin.html`). There is also a discreet **ADMIN** link in the website footer.

On the first login, your **five existing projects and five gallery photographs** appear automatically, along with your text, tools and contact details. Click **Save & publish** once to save this starting content to Supabase. After that you can:

- **Projects:** edit project details, create or delete a project, add several project images, reorder items.
- **Photography:** upload pictures, edit both-language captions and categories, reorder/delete gallery entries.
- **Website text:** edit homepage, About, services, photography, contact, navigation and more in both English and Norwegian.
- **Tools & interests:** edit each pop-up's explanation and the personal description in either language.
- **Settings & portraits:** replace your homepage/About pictures, public contact email and Instagram link.

Always click **Save & publish** after editing. The public website displays your latest saved content when reloaded.

## Privacy and safety

- The admin URL is *not* a secret; **Supabase authorization is what protects edits**. Use a strong, unique password and enable available account protections.
- Visitors can see your published content and published images. Do not post private information or images you do not have permission to share.
- Uploaded images are stored in a **public** bucket because the portfolio needs to show them to everyone. This is intended; do not upload private files there.
- Deleting an image from a project or gallery removes it from the website after publishing. To reclaim storage, delete that unused file separately from Supabase **Storage**.
- The initial content is built into `index.html` and `script.js` as an offline fallback. If the CMS service is unavailable, the older bundled content may appear. Don't use the admin to publish confidential or sensitive details.
- The admin requires an internet connection and a hosted site; **double-clicking `index.html` locally is fine for previewing**, but uploaded content and account login are meant for the online published site.
- Keep a copy of your website ZIP and important uploaded images as a backup.

## Troubleshooting

**"Admin panel setup" still displays:** You haven't saved the Supabase URL/key correctly, or you're viewing an old deployed version. Confirm `cms-config.js` is uploaded.

**Sign-in failed:** Check the user exists in Supabase Authentication → Users and is confirmed; check your password.

**"new row violates row-level security policy":** Your SQL still contains the placeholder or the user UID in the SQL differs from the UID of the account you signed in with.

**Image upload error:** Make sure the `portfolio-media` bucket exists, is marked **public**, and that its upload policy matches your user ID. Limit: 10 MB per image. JPEG, PNG, WebP, GIF, AVIF only.

**Changes didn't appear on website:** Refresh the public portfolio. Confirm that you clicked Save & publish and that the same `cms-config.js` was deployed with both public and admin pages. Check the browser console if the content service is unreachable.

**Need to change your admin password?** Change or reset it using the Supabase Authentication account workflow; do not edit website code to change passwords.

## Tech notes

This implementation uses browser-side `@supabase/supabase-js` v2 with Supabase Auth and a JSON-backed `portfolio_data` row. Only the authenticated owner's UID can insert/update it; the public site reads the row anonymously. Media uploads use a random filename inside a user-ID folder and are limited to safe image MIME types; they cannot overwrite existing files. The website still works as a static site when the CMS is disconnected.
