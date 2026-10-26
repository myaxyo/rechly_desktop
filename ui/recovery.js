document.addEventListener("DOMContentLoaded", async () => {
  const info = await window.rechly.getStorageInfo();
  document.getElementById("recovery-message").textContent = info.error || "";
  document.getElementById("recovery-path").textContent = info.databasePath;
  document.getElementById("recover-restart").onclick = () =>
    window.rechly.relaunchAfterRecovery();
  document.getElementById("recover-backup").onclick = async () => {
    const restored = await StorageUI.importBackup();
    if (restored) {
      document.getElementById("recovery-message").textContent =
        "Daten wiederhergestellt. Starten Sie die App jetzt neu.";
      document.getElementById("recover-backup").disabled = true;
    }
  };
});
