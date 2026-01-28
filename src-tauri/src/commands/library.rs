use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

// Store the app data directory path (set once during app initialization)
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Initialize the library storage with app data directory
pub fn init_library_storage(app_data_dir: PathBuf) {
    let _ = APP_DATA_DIR.set(app_data_dir);
}

/// Get the library file path
fn get_library_path() -> Result<PathBuf, String> {
    let app_data_dir = APP_DATA_DIR
        .get()
        .ok_or_else(|| "Library storage not initialized".to_string())?;

    // Ensure directory exists
    fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(app_data_dir.join("library.json"))
}

/// Load library data from file
#[tauri::command]
pub async fn load_library() -> Result<String, String> {
    let path = get_library_path()?;

    if !path.exists() {
        // Return empty library if file doesn't exist
        return Ok(r#"{"entries":{},"folders":{}}"#.to_string());
    }

    fs::read_to_string(&path).map_err(|e| format!("Failed to read library file: {}", e))
}

/// Save library data to file
#[tauri::command]
pub async fn save_library(data: String) -> Result<(), String> {
    let path = get_library_path()?;

    fs::write(&path, data).map_err(|e| format!("Failed to write library file: {}", e))
}

/// Get library file path (for debugging)
#[tauri::command]
pub async fn get_library_file_path() -> Result<String, String> {
    let path = get_library_path()?;
    Ok(path.to_string_lossy().to_string())
}
