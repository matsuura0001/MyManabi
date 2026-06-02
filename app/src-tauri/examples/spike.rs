//! Headless run of the codex app-server spike (no GUI).
//!
//!   cargo run --example spike
//!
//! Proves the Rust client can reach codex app-server, authenticate, and run a
//! turn. Override the binary with `CODEX_BIN` if codex is not on the default
//! npm global path.

#[tokio::main]
async fn main() {
    let prompt = "小学3年生向けの足し算の問題を1問だけ、答え付きで作ってください。";
    match app_lib::codex::run_spike(prompt).await {
        Ok(outcome) => {
            println!("account: {:?} ({:?})", outcome.account_email, outcome.plan_type);
            println!("model:   {:?}", outcome.model);
            println!("----- generated -----\n{}", outcome.problem_text);
        }
        Err(err) => {
            eprintln!("spike failed: {err}");
            std::process::exit(1);
        }
    }
}
