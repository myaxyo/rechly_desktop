// electron-builder 26 calls this signer only when an identity resolves; electron-builder.yml sets
// mac.identity "-" so local and CI builds get an ad-hoc signature instead of none.
// Ad-hoc signatures provide local bundle integrity; they do not provide Apple trust.
const { signAsync } = require("@electron/osx-sign");
module.exports = async function signMac(options) {
  if (process.platform !== "darwin")
    throw new Error("macOS signing requires a Mac.");
  if (options.platform !== "darwin")
    throw new Error(
      "This signing hook supports direct macOS distribution only.",
    );
  const wantsNotarization = Boolean(
    process.env.APPLE_ID ||
      process.env.APPLE_API_KEY ||
      process.env.APPLE_KEYCHAIN_PROFILE ||
      process.env.RECHLY_REQUIRE_NOTARIZATION === "1",
  );
  const identity = options.identity || "-";
  if (identity === "-" && wantsNotarization)
    throw new Error(
      "Notarization requires a Developer ID Application certificate. Install it in Keychain and enable signing identity discovery.",
    );
  if (
    process.env.RECHLY_REQUIRE_NOTARIZATION === "1" &&
    !(
      process.env.APPLE_ID ||
      process.env.APPLE_API_KEY ||
      process.env.APPLE_KEYCHAIN_PROFILE
    )
  )
    throw new Error(
      "Notarization credentials are required. Configure an Apple ID, API key, or Keychain profile.",
    );
  console.log(
    identity === "-"
      ? "Signing local build with an ad-hoc identity (not Apple notarized)."
      : "Signing with the configured Apple certificate.",
  );
  await signAsync({
    ...options,
    identity,
    identityValidation: false,
    optionsForFile:
      identity === "-"
        ? (file) => ({ ...options.optionsForFile?.(file), timestamp: "none" })
        : options.optionsForFile,
    // Automatic team entitlements require a real certificate. Preserve builder's per-file entitlements.
    preAutoEntitlements: identity === "-" ? false : options.preAutoEntitlements,
    // The default enables --strict. Passing true in osx-sign 1.3 produces --strict=true.
    strictVerify: undefined,
  });
};
