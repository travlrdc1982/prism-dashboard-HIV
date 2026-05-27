# Supabase Credential Cleanup: Plain-English Summary

**What changed?**
- The Supabase project URL and anon key are no longer hardcoded in the codebase. Instead, they are now stored in a local environment file (`.env.local`).
- This prevents sensitive credentials from being exposed in version control and improves security.

**What do you need to do?**
1. **Generate a new anon key in Supabase:**
   - Go to your Supabase project dashboard.
   - Navigate to Project Settings > API.
   - Click "Generate new anon key" to rotate the old key.
2. **Update your `.env.local` file:**
   - Copy the new Supabase URL and anon key into the `.env.local` file:
     ```
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-new-anon-key
     ```
3. **Never commit `.env.local` to git:**
   - This file should remain local and private. It is already git-ignored by default in most setups.
4. **Restart your development server:**
   - After updating the environment file, restart your dev server so the new credentials are loaded.

**Why is this important?**
- Keeping credentials out of code prevents accidental leaks and protects your data.
- Rotating the key ensures that any previously exposed key is no longer valid.

**If you have questions or need help, let the dev team know!**
