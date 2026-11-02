const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Load compiled modules from out/ (built via tsc)
const { RECHLY_MODEL_FAMILY } = require("../out/types");
const { getSystemProfile } = require("../out/setup");
const { matchModelToTier, FEATURED_MODEL } = require("../out/ai");
const { getDefaultStore } = require("../out/storeDefaults");
const { validateStore } = require("../out/storageValidation");
const { DatabaseStore } = require("../out/databaseStore");

test("RECHLY_MODEL_FAMILY defines the 3-tier production model registry", () => {
  assert.ok(RECHLY_MODEL_FAMILY["3b"], "3b tier exists");
  assert.ok(RECHLY_MODEL_FAMILY["1.5b"], "1.5b tier exists");
  assert.ok(RECHLY_MODEL_FAMILY["0.5b"], "0.5b tier exists");

  const tier3b = RECHLY_MODEL_FAMILY["3b"];
  assert.equal(tier3b.id, "3b");
  assert.equal(tier3b.name, "Rechly-DE-3B (Flagship)");
  assert.equal(tier3b.tag, "Flagship");
  assert.equal(tier3b.modelIdentifier, "jonprompter/rechly-de-3b");
  assert.equal(tier3b.paramSize, "3B Parameter");
  assert.equal(tier3b.downloadSize, "1.93 GB");
  assert.equal(tier3b.ramRequired, "~2.5 GB RAM");
  assert.equal(tier3b.minRamGb, 8);
  assert.ok(tier3b.badge.includes("100% Benchmark"));

  const tier15b = RECHLY_MODEL_FAMILY["1.5b"];
  assert.equal(tier15b.id, "1.5b");
  assert.equal(tier15b.name, "Rechly-DE-1.5B (Slim)");
  assert.equal(tier15b.tag, "Slim");
  assert.equal(tier15b.modelIdentifier, "jonprompter/rechly-de-1.5b");
  assert.equal(tier15b.paramSize, "1.5B Parameter");
  assert.equal(tier15b.downloadSize, "986 MB");
  assert.equal(tier15b.ramRequired, "~1.1 GB RAM");
  assert.equal(tier15b.minRamGb, 4);

  const tier05b = RECHLY_MODEL_FAMILY["0.5b"];
  assert.equal(tier05b.id, "0.5b");
  assert.equal(tier05b.name, "Rechly-DE-0.5B (Nano)");
  assert.equal(tier05b.tag, "Nano");
  assert.equal(tier05b.modelIdentifier, "jonprompter/rechly-de-0.5b");
  assert.equal(tier05b.paramSize, "0.5B Parameter");
  assert.equal(tier05b.downloadSize, "398 MB");
  assert.equal(tier05b.ramRequired, "~512 MB RAM");
  assert.equal(tier05b.minRamGb, 2);
});

test("Hardware auto-detection recommends optimal model tier based on system specs", () => {
  // 1. Apple Silicon (macOS arm64) -> Recommend 3B even if RAM is 8 GB
  const appleSiliconProfile = getSystemProfile({
    platform: "darwin",
    arch: "arm64",
    totalmem: () => 16 * 1024 ** 3,
    cpus: () => [{ model: "Apple M2 Pro" }],
  });
  assert.equal(appleSiliconProfile.isAppleSilicon, true);
  assert.equal(appleSiliconProfile.recommendedTier, "3b");
  assert.equal(appleSiliconProfile.totalRamGb, 16);
  assert.equal(appleSiliconProfile.cpuModel, "Apple M2 Pro");
  assert.ok(appleSiliconProfile.recommendationReason.includes("Apple Silicon"));

  // 2. High-RAM x64 PC (Windows/Linux >= 8 GB RAM) -> Recommend 3B
  const highRamPcProfile = getSystemProfile({
    platform: "win32",
    arch: "x64",
    totalmem: () => 32 * 1024 ** 3,
    cpus: () => [{ model: "AMD Ryzen 9 5950X" }],
  });
  assert.equal(highRamPcProfile.isAppleSilicon, false);
  assert.equal(highRamPcProfile.recommendedTier, "3b");
  assert.equal(highRamPcProfile.totalRamGb, 32);
  assert.ok(highRamPcProfile.recommendationReason.includes("≥ 8 GB"));

  // 3. Mid-range PC / Laptop (4 - 7 GB RAM, e.g. 6 GB) -> Recommend 1.5B
  const midRamProfile = getSystemProfile({
    platform: "linux",
    arch: "x64",
    totalmem: () => 6 * 1024 ** 3,
    cpus: () => [{ model: "Intel Core i5-8250U" }],
  });
  assert.equal(midRamProfile.recommendedTier, "1.5b");
  assert.equal(midRamProfile.totalRamGb, 6);
  assert.ok(midRamProfile.recommendationReason.includes("1.5B (Slim)"));

  // 4. Low-spec device / VPS (< 4 GB RAM, e.g. 2 GB) -> Recommend 0.5B
  const lowRamProfile = getSystemProfile({
    platform: "linux",
    arch: "x64",
    totalmem: () => 2 * 1024 ** 3,
    cpus: () => [{ model: "Intel Celeron N4020" }],
  });
  assert.equal(lowRamProfile.recommendedTier, "0.5b");
  assert.equal(lowRamProfile.totalRamGb, 2);
  assert.ok(lowRamProfile.recommendationReason.includes("0.5B (Nano)"));

  // 5. Native host inspection runs without errors and returns valid SystemProfile
  const nativeProfile = getSystemProfile();
  assert.ok(["3b", "1.5b", "0.5b"].includes(nativeProfile.recommendedTier));
  assert.ok(nativeProfile.totalRamGb > 0);
  assert.equal(typeof nativeProfile.cpuModel, "string");
  assert.equal(typeof nativeProfile.isAppleSilicon, "boolean");
});

test("Model identifier tier matcher correctly maps strings to tiers", () => {
  assert.equal(matchModelToTier("3b"), "3b");
  assert.equal(matchModelToTier("1.5b"), "1.5b");
  assert.equal(matchModelToTier("0.5b"), "0.5b");

  assert.equal(matchModelToTier("jonprompter/rechly-de-3b"), "3b");
  assert.equal(matchModelToTier("jonprompter/rechly-de-3b:latest"), "3b");
  assert.equal(matchModelToTier("jonprompter/Rechly-DE-3B"), "3b");

  assert.equal(matchModelToTier("jonprompter/rechly-de-1.5b"), "1.5b");
  assert.equal(matchModelToTier("jonprompter/rechly-de-1.5b:latest"), "1.5b");

  assert.equal(matchModelToTier("jonprompter/rechly-de-0.5b"), "0.5b");
  assert.equal(matchModelToTier("jonprompter/rechly-de-0.5b:latest"), "0.5b");

  assert.equal(matchModelToTier("unknown-model-xyz"), undefined);
});

test("Database store defaults and validation support multi-tier model configuration", () => {
  const defaults = getDefaultStore();
  assert.equal(defaults.aiSettings.active_provider, "ollama");
  assert.equal(defaults.aiSettings.selected_tier, "3b");
  assert.equal(defaults.aiSettings.ollama_model, "jonprompter/rechly-de-3b");

  // validateStore accepts valid selected_tier
  const validated = validateStore(defaults);
  assert.equal(validated.aiSettings.selected_tier, "3b");

  const validated15 = validateStore({
    ...defaults,
    aiSettings: {
      ...defaults.aiSettings,
      selected_tier: "1.5b",
      ollama_model: "jonprompter/rechly-de-1.5b",
    },
  });
  assert.equal(validated15.aiSettings.selected_tier, "1.5b");

  // validateStore rejects invalid tier
  assert.throws(
    () =>
      validateStore({
        ...defaults,
        aiSettings: { ...defaults.aiSettings, selected_tier: "7b" },
      }),
    /KI-Modellstufe ungültig/
  );
});

test("Database store allows hot-switching and persisting model tiers", () => {
  const tmpDir = path.join(__dirname, "../dist/test-vault-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const dummySecrets = {
    encrypt: (v) => Buffer.from(v).toString("base64"),
    decrypt: (v) => Buffer.from(v, "base64").toString("utf8"),
  };

  const store = new DatabaseStore(tmpDir, dummySecrets);
  store.initialize();

  const initialAi = store.getAiSettings();
  assert.equal(initialAi.selected_tier, "3b");

  // Switch to 1.5b tier
  const updated15 = store.saveAiSettings({
    selected_tier: "1.5b",
    ollama_model: RECHLY_MODEL_FAMILY["1.5b"].modelIdentifier,
  });
  assert.equal(updated15.selected_tier, "1.5b");
  assert.equal(updated15.ollama_model, "jonprompter/rechly-de-1.5b");

  // Switch to 0.5b tier
  const updated05 = store.saveAiSettings({
    selected_tier: "0.5b",
    ollama_model: RECHLY_MODEL_FAMILY["0.5b"].modelIdentifier,
  });
  assert.equal(updated05.selected_tier, "0.5b");
  assert.equal(updated05.ollama_model, "jonprompter/rechly-de-0.5b");

  // Verify reload from database retains the tier
  const reloaded = store.getAiSettings();
  assert.equal(reloaded.selected_tier, "0.5b");
  assert.equal(reloaded.ollama_model, "jonprompter/rechly-de-0.5b");

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

test("Ollama API mock: check tags, pull streaming progress with percent, and delete model", async () => {
  const http = require("node:http");
  const { checkOllama, pullOllamaModel, deleteOllamaModel } = require("../out/ai");

  let receivedDeleteModel = null;

  // Spin up a mock Ollama HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === "/api/tags" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          models: [
            { name: "jonprompter/rechly-de-3b:latest" },
            { name: "jonprompter/rechly-de-0.5b" },
          ],
        })
      );
      return;
    }

    if (req.url === "/api/pull" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      // Stream 3 progress steps
      res.write(
        JSON.stringify({
          status: "downloading",
          completed: 0,
          total: 1000,
        }) + "\n"
      );
      res.write(
        JSON.stringify({
          status: "downloading",
          completed: 500,
          total: 1000,
        }) + "\n"
      );
      res.write(
        JSON.stringify({
          status: "success",
          completed: 1000,
          total: 1000,
        }) + "\n"
      );
      res.end();
      return;
    }

    if (req.url === "/api/delete" && req.method === "DELETE") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          receivedDeleteModel = parsed.model;
        } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success" }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const mockHost = `http://127.0.0.1:${port}`;

  try {
    // 1. checkOllama returns installed tiers
    const status = await checkOllama(mockHost);
    assert.equal(status.connected, true);
    assert.equal(status.installedTiers["3b"], true);
    assert.equal(status.installedTiers["1.5b"], false);
    assert.equal(status.installedTiers["0.5b"], true);
    assert.equal(status.activeTier, "3b");

    // 2. pullOllamaModel streams progress with percent
    const progressUpdates = [];
    const pullResult = await pullOllamaModel(
      mockHost,
      "jonprompter/rechly-de-1.5b",
      (p) => progressUpdates.push(p)
    );
    assert.equal(pullResult.success, true);
    assert.equal(progressUpdates.length, 3);
    assert.equal(progressUpdates[0].percent, 0);
    assert.equal(progressUpdates[1].percent, 50);
    assert.equal(progressUpdates[2].percent, 100);

    // 3. deleteOllamaModel calls /api/delete
    const deleteResult = await deleteOllamaModel(
      mockHost,
      "jonprompter/rechly-de-0.5b"
    );
    assert.equal(deleteResult.success, true);
    assert.equal(receivedDeleteModel, "jonprompter/rechly-de-0.5b");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
