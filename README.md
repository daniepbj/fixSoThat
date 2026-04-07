# fixSoThat

React front page with a single animated feature component that says "Hellow world".

## Use pnpm (modern)

1. Install dependencies:

   ```powershell
   corepack pnpm install
   ```

2. Start dev server:

   ```powershell
   corepack pnpm dev
   ```

3. Build for production:

   ```powershell
   corepack pnpm build
   ```

## Deploy to GitHub Pages

1. Build GitHub Pages output into `docs` on main:

   ```powershell
   corepack pnpm build:pages
   ```

2. Commit and push the generated `docs` folder on `main`.

3. In GitHub repo settings, set Pages source to `main` branch and `/docs` folder.
