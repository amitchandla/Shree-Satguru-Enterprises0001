# Shree Satguru Enterprises — Website

A production-ready business website for **Shree Satguru Enterprises**, a wholesale hardware, paint & electrical products shop owned by **Mr. Hansraj**, in Mohanpur, Rewari, Haryana.

Static HTML/CSS/JS frontend + Supabase backend (Auth, Postgres, Storage, Row Level Security).

---

## Project structure

```
shree-satguru-enterprises/
├── index.html
├── about.html
├── products.html
├── gallery.html
├── contact.html
├── owner-login.html
├── owner-dashboard.html
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── supabase.js        # Supabase client init (reads config.js)
│   │   ├── config.example.js  # copy → config.js with your real keys
│   │   ├── main.js            # nav, business info, product search
│   │   ├── auth.js            # owner login + session guard
│   │   ├── gallery.js         # public gallery + lightbox
│   │   ├── contact.js         # inquiry form
│   │   └── dashboard.js       # owner dashboard logic
│   ├── images/
│   └── icons/
├── supabase/
│   ├── schema.sql
│   ├── rls-policies.sql
│   └── storage-policies.sql
├── .env.example
├── .gitignore
└── README.md
```

---

## Step 1 — Create a Supabase Project

Go to [supabase.com](https://supabase.com), create a free account, and create a new project. Note your **Project URL** and **anon public key** (Project Settings → API) — you'll need them in Step 8.

## Step 2 — Create Database Tables

Open the Supabase **SQL Editor**.

## Step 3 — Run SQL Schema

Paste the full contents of `supabase/schema.sql` and run it. This creates `profiles`, `business_settings`, `inquiries`, and `gallery_media`, plus a trigger that auto-creates a profile row for every new signup.

## Step 4 — Configure RLS

Paste and run `supabase/rls-policies.sql`. This enables Row Level Security on every table and adds policies so that:
- Anyone can read business info and gallery media.
- Anyone can submit an inquiry, but only the owner can read/delete inquiries.
- Only the owner can add, edit, or delete gallery media or business settings.

These rules are enforced by Postgres itself — not by the website's JavaScript — so they hold even if someone calls the API directly.

## Step 5 — Create Storage Bucket

Paste and run `supabase/storage-policies.sql`. This creates the `business-media` bucket (public read, 50MB limit, restricted to JPG/PNG/WEBP images and MP4/WEBM videos).

## Step 6 — Configure Storage Policies

Already included in the same `storage-policies.sql` file from Step 5 — it sets up public read access and owner-only upload/update/delete.

## Step 7 — Create Owner Account

1. In Supabase, go to **Authentication → Users → Add user**, and create an account with an email and the password you want the owner to use (e.g. the one Mr. Hansraj will use to log in). Set a strong password directly in Supabase — **never write it into any file in this project or commit it to GitHub.**
2. Signing up automatically creates a matching row in `profiles` with `role = 'customer'` (via the trigger from Step 3).
3. Promote that account to owner by running this in the SQL Editor (replace the email):

   ```sql
   update public.profiles
   set role = 'owner'
   where email = 'owner-email@example.com';
   ```

4. Only this account can now log in at `owner-login.html` and reach the dashboard — every other signed-up user keeps `role = 'customer'` and has no admin access.

## Step 8 — Set Environment Variables

1. Copy `assets/js/config.example.js` to `assets/js/config.js`.
2. Fill in your real `SUPABASE_URL` and `SUPABASE_ANON_KEY` (from Step 1).
3. `assets/js/config.js` is already listed in `.gitignore`, so it will never be pushed to a public GitHub repository.
4. The anon key is safe to expose in frontend code — it only works within the limits set by your RLS policies. **Never** put the Service Role key in any frontend file.

## Step 9 — Connect Website

Open `index.html` in a browser (or serve the folder with any static file server, e.g. `npx serve .`). The site will load business info live from Supabase, with sensible fallback text if the table is briefly unreachable.

## Step 10 — Upload Project to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Shree Satguru Enterprises website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shree-satguru-enterprises.git
git push -u origin main
```

`assets/js/config.js`, `.env`, and any password are excluded by `.gitignore` — double check with `git status` before your first push that none of them are staged.

## Step 11 — Deploy Website

Any static hosting provider works (Netlify, Vercel, GitHub Pages, Cloudflare Pages). Deploy the repository as a static site, then add `assets/js/config.js` (or equivalent environment variables, depending on your host) directly on the hosting platform — do not commit it.

---

## Security notes

- The Service Role key is never used anywhere in this project. Only the anon key is used, and it relies entirely on the RLS policies in `supabase/rls-policies.sql` and `supabase/storage-policies.sql` for protection.
- The owner password is never hardcoded — it lives only in Supabase Auth.
- `owner-dashboard.html` checks the user's session and `profiles.role` on load and redirects to `owner-login.html` if either check fails (`assets/js/auth.js` → `requireOwnerSession()`). This is a UX convenience — the real enforcement is the database policies, which block unauthorized reads/writes regardless of what the browser does.

## Updating business info, location, and gallery

Everything customer-facing that changes over time — phone numbers, address, the WhatsApp number, the Google Maps "Get Directions" link, and gallery photos/videos — is editable from the Owner Dashboard (`owner-dashboard.html`) without touching any code.
