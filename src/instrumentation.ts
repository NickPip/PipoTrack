// Runs once when the server process starts. We validate the environment here
// so a misconfigured deploy fails at boot with a clear message instead of
// silently degrading (e.g. a no-op rate limiter) on first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
