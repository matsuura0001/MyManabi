//! Minimal client for the `codex app-server` JSON-RPC backend.
//!
//! Spike scope: spawn `codex app-server`, perform the handshake, confirm the
//! signed-in account, then run one turn and return the assistant's text.
//! Transport is newline-delimited JSON over stdio (verified empirically).
//!
//! This is intentionally small. It drives the happy path only and ignores
//! notifications that are not needed for a single text turn. Later slices will
//! grow this into a proper long-lived session client (thread reuse, streaming
//! deltas to the UI, turn/steer for the "もっと説明して" loop, etc.).

use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{ChildStdin, ChildStdout, Command};

/// Result of the connectivity spike, returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpikeOutcome {
    /// Signed-in account email, if any (proves ChatGPT auth works).
    pub account_email: Option<String>,
    /// Plan type, e.g. "plus".
    pub plan_type: Option<String>,
    /// Model that produced the turn, if reported.
    pub model: Option<String>,
    /// Assistant text accumulated from the turn.
    pub problem_text: String,
}

/// Resolve how to launch codex. Override with `CODEX_BIN` when needed.
fn codex_command() -> Command {
    if let Ok(path) = std::env::var("CODEX_BIN") {
        return Command::new(path);
    }

    #[cfg(windows)]
    if let Ok(appdata) = std::env::var("APPDATA") {
        let base = PathBuf::from(&appdata).join("npm");
        let exe = base
            .join("node_modules/@openai/codex/node_modules")
            .join("@openai/codex-win32-x64/vendor")
            .join("x86_64-pc-windows-msvc/bin/codex.exe");
        if exe.exists() {
            return Command::new(exe);
        }
        let shim = base.join("codex.cmd");
        if shim.exists() {
            return Command::new(shim);
        }
    }

    Command::new("codex")
}

async fn write_msg(stdin: &mut ChildStdin, value: &Value) -> Result<(), String> {
    let mut line = serde_json::to_string(value).map_err(|e| e.to_string())?;
    line.push('\n');
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("write to app-server: {e}"))?;
    stdin
        .flush()
        .await
        .map_err(|e| format!("flush app-server: {e}"))
}

/// Read the next JSON message. `Ok(None)` means the stream closed; an empty
/// line yields `Ok(Some(Value::Null))` so callers can simply skip it.
async fn read_msg(reader: &mut Lines<BufReader<ChildStdout>>) -> Result<Option<Value>, String> {
    match reader.next_line().await.map_err(|e| e.to_string())? {
        None => Ok(None),
        Some(line) => {
            let line = line.trim();
            if line.is_empty() {
                return Ok(Some(Value::Null));
            }
            let value = serde_json::from_str(line)
                .map_err(|e| format!("parse app-server message: {e}: {line}"))?;
            Ok(Some(value))
        }
    }
}

/// Send a request and read until its matching response arrives, skipping any
/// interleaved notifications (none are needed for the simple requests here).
async fn request(
    stdin: &mut ChildStdin,
    reader: &mut Lines<BufReader<ChildStdout>>,
    id: &mut i64,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    *id += 1;
    let request_id = *id;
    write_msg(
        stdin,
        &json!({ "jsonrpc": "2.0", "id": request_id, "method": method, "params": params }),
    )
    .await?;

    loop {
        match read_msg(reader).await? {
            None => return Err(format!("app-server closed before responding to {method}")),
            Some(Value::Null) => continue,
            Some(msg) => {
                if msg.get("id").and_then(Value::as_i64) == Some(request_id) {
                    if let Some(err) = msg.get("error") {
                        return Err(format!("{method} error: {err}"));
                    }
                    return Ok(msg.get("result").cloned().unwrap_or(Value::Null));
                }
                // Otherwise a notification or unrelated message: ignore.
            }
        }
    }
}

/// Run the full connectivity spike for a single text turn.
pub async fn run_spike(prompt: &str) -> Result<SpikeOutcome, String> {
    let mut child = codex_command()
        .arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("spawn codex app-server: {e}"))?;

    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    let mut id = 0i64;

    // 1. initialize handshake.
    request(
        &mut stdin,
        &mut reader,
        &mut id,
        "initialize",
        json!({ "clientInfo": { "name": "MyManabi", "version": "0.1.0" } }),
    )
    .await?;

    // 2. initialized notification (no response expected).
    write_msg(
        &mut stdin,
        &json!({ "jsonrpc": "2.0", "method": "initialized" }),
    )
    .await?;

    // 3. account/read — confirms ChatGPT auth under the flat-rate plan.
    let account = request(&mut stdin, &mut reader, &mut id, "account/read", json!({})).await?;
    let account_email = account
        .pointer("/account/email")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let plan_type = account
        .pointer("/account/planType")
        .and_then(Value::as_str)
        .map(str::to_owned);

    // 4. thread/start — no tools needed for a text turn, so no approvals.
    let thread = request(
        &mut stdin,
        &mut reader,
        &mut id,
        "thread/start",
        json!({ "approvalPolicy": "never", "sandbox": "read-only" }),
    )
    .await?;
    let thread_id = thread
        .pointer("/thread/id")
        .and_then(Value::as_str)
        .ok_or("thread/start did not return a thread id")?
        .to_owned();
    let model = thread
        .get("model")
        .and_then(Value::as_str)
        .map(str::to_owned);

    // 5. turn/start, then accumulate assistant deltas until turn/completed.
    id += 1;
    write_msg(
        &mut stdin,
        &json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "turn/start",
            "params": {
                "threadId": thread_id,
                "input": [{ "type": "text", "text": prompt }],
            },
        }),
    )
    .await?;

    let mut problem_text = String::new();
    loop {
        match read_msg(&mut reader).await? {
            None => return Err("app-server closed during turn".into()),
            Some(Value::Null) => continue,
            Some(msg) => match msg.get("method").and_then(Value::as_str) {
                Some("item/agentMessage/delta") => {
                    if let Some(delta) = msg.pointer("/params/delta").and_then(Value::as_str) {
                        problem_text.push_str(delta);
                    }
                }
                Some("turn/completed") => break,
                Some("error") => {
                    return Err(format!("turn error: {}", msg.get("params").unwrap_or(&Value::Null)));
                }
                _ => {}
            },
        }
    }

    let _ = child.kill().await;

    Ok(SpikeOutcome {
        account_email,
        plan_type,
        model,
        problem_text: problem_text.trim().to_owned(),
    })
}
