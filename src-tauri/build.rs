// src-tauri/build.rs
// Runs before every Cargo compilation.
// Loads .env from the workspace root so TMDB_API_KEY is available
// to the app via env!() at compile time.

fn main() {
    // Load .env file if it exists (dev only — in CI the var comes from GitHub Secrets)
    let env_path = std::path::Path::new("../.env");
    let release = std::env::var("PROFILE").as_deref() == Ok("release");
    if !release && env_path.exists() {
        let content = std::fs::read_to_string(env_path).expect("Failed to read .env");
        for line in content.lines() {
            let line = line.trim();
            // Skip comments and empty lines
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim().trim_matches('"').trim_matches('\'');
                // Set for this build process so env!() can read it
                println!("cargo:rustc-env={key}={val}");
                // Re-run build.rs if .env changes
                println!("cargo:rerun-if-env-changed={key}");
            }
        }
    }
    if release {
        for key in ["TMDB_API_KEY", "RAWG_API_KEY"] {
            println!("cargo:rustc-env={key}=");
            println!("cargo:rerun-if-env-changed={key}");
        }
    }
    println!("cargo:rerun-if-env-changed=PROFILE");
    // Always re-run if .env itself changes
    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
