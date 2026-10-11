# Contributing

Contributions are welcome.

## Development Workflow

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build all plugins:
   ```bash
   npm run build
   ```
4. Run type checks and linters:
   ```bash
   npm run type-check
   npm run lint
   ```

## Creating a New Plugin

Follow the OpenTabs plugin standard:
1. Create a new directory under `plugins/<name>`.
2. Initialize `package.json` with the required `opentabs` metadata field and URL patterns.
3. Keep tools isolated with explicit Zod schemas.
4. Never auto-submit critical forms (checkout, final job submission, payments). Always leave the final submit action for the human user.
5. Ensure `jitless` mode is configured to prevent Trusted Types CSP violations on pages requiring strict scripts.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
