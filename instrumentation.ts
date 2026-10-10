export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("./lib/db");
    initDb();
    // Fresh database (no users yet): load the demo agency dataset so the
    // product is alive on first login. The buyer wipes it from Settings
    // ("Remove all client data") before going live with real clients.
    const { userCount } = await import("./lib/auth");
    if (userCount() === 0) {
      const { seedDemo } = await import("./lib/seed");
      seedDemo();
    }
  }
}
