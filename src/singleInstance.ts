// This module must load before the vault: two processes must not write stale snapshots
// of the same local store. Electron scopes the lock to the user-data directory.
import { app } from "electron";
import * as fs from "node:fs";

const profileOverride = app.commandLine.getSwitchValue("user-data-dir");
if (profileOverride) {
    fs.mkdirSync(profileOverride, { recursive: true });
    app.setPath("userData", profileOverride);
}
if (!app.requestSingleInstanceLock()) app.exit(0);
