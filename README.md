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

This repo uses GitHub Actions for deployment.

1. Push or merge your changes to `main`.

2. GitHub Actions will automatically:

   - install dependencies
   - run `pnpm build`
   - deploy the generated `dist` folder to Pages

3. In GitHub repo settings, set Pages source to `GitHub Actions` (not `main/docs`).

### Optional local production check

Run this locally before pushing:

   ```powershell
   corepack pnpm build
   ```
