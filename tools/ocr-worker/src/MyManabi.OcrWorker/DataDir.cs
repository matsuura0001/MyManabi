namespace MyManabi.OcrWorker;

/// <summary>
/// Resolve DATA_DIR the same way the Tauri app does: <c>MYMANABI_DATA_DIR</c> if set,
/// otherwise <c>%APPDATA%/MyManabi</c> (cross-platform application-data folder).
/// </summary>
public static class DataDir
{
    public static string Resolve()
    {
        var env = Environment.GetEnvironmentVariable("MYMANABI_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(env))
            return Path.GetFullPath(env);

        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "MyManabi");
    }
}
