import { app, safeStorage } from "electron";
import { DatabaseStore } from "./databaseStore";

function requireSecretStorage(): void {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error(
      "Der sichere Schlüsselspeicher des Betriebssystems ist nicht verfügbar. Bitte entsperren Sie den Schlüsselbund oder verwenden Sie lokale KI ohne API-Schlüssel.",
    );
}
const store = new DatabaseStore(app.getPath("userData"), {
  encrypt(value) {
    requireSecretStorage();
    return safeStorage.encryptString(value).toString("base64");
  },
  decrypt(value) {
    requireSecretStorage();
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  },
});
export default store;
