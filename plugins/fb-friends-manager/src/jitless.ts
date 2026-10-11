// Ensure Zod's jitless mode is active before any schema is created
// Prevents TrustedScript CSP violations on pages requiring Trusted Types (YouTube, Outlook, etc.)
const g = globalThis as unknown as { __zod_globalConfig?: { jitless?: boolean } };
g.__zod_globalConfig = Object.assign(g.__zod_globalConfig ?? {}, { jitless: true });
