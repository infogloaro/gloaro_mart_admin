# Gloaro Mart admin console

## Live deploy

The live console is served by the backend at **https://gloaro-mart-backend.onrender.com/admin** (no separate host).

1. `npm run build:live`: builds with `.env.live` (the live API) and base `/admin/` straight into `Gloaro_mart_backend/admin_console/`.
2. Commit `admin_console/` in the backend repo and push its `main`; Render redeploys and the new console shows on the next visit.

Local development is unchanged: `npm run dev` (base `/`, API from `.env`). Without `VITE_API_URL` a build falls back to an old backend address, so always build the live console with `build:live`.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
