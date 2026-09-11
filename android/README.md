# Chromi Android build

Package/applicationId: `com.sfxi.chromi`

The Android app is a native WebView shell around `../public`. Gradle copies the web app into `app/src/main/assets/www` during `preBuild`.

The Node/Express backend is **not** bundled into the APK. Set the GitHub repository variable `CHROMI_API_BASE_URL` to a public HTTPS URL for the backend before relying on `/api/chat` and the server-side search proxy.

For Google OAuth in the APK, the Android OAuth client must use the exact applicationId above and the SHA-1 of the release signing certificate. Supabase must allow the redirect URL `chromi://auth-callback`, and the Google provider must use the Web OAuth client for the Supabase callback.

The release signing keystore is injected only in GitHub Actions through repository secrets. Never commit the `.jks` or `keystore.properties`.
