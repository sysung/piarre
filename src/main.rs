use rig_core::{completion::CompletionRequest, providers::openai::OpenAIConfig};
use serde_json::json;
use std::{env, error::Error, process::ExitCode, time::Duration};

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Request failed: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let prompt = env::args().skip(1).collect::<Vec<_>>().join(" ");
    if prompt.trim().is_empty() {
        return Err("provide a prompt: docker compose run --rm harness \"What is 2 + 2?\"".into());
    }
    let endpoint = env::var("PIARRE_ENDPOINT")?;
    let model_name = env::var("PIARRE_MODEL")?;
    if endpoint.trim().is_empty() || model_name.trim().is_empty() {
        return Err("PIARRE_ENDPOINT and PIARRE_MODEL must not be empty".into());
    }
    let model = OpenAIConfig::new("local-no-secret")
        .with_base_url(&endpoint)
        .client()
        .chat(&model_name);
    let request = CompletionRequest::new(prompt)
        .temperature(0.0)
        .max_tokens(128)
        .additional_params(json!({"chat_template_kwargs": {"enable_thinking": false}}));
    eprintln!("Model: {model_name}\nEndpoint: {endpoint}");
    let response = tokio::time::timeout(Duration::from_secs(120), model.call(request))
        .await
        .map_err(|_| "local request timed out after 120 seconds; backend work may still be running")??;
    let text = response.text();
    if text.trim().is_empty() {
        return Err("the model returned no text".into());
    }
    println!("{text}");
    Ok(())
}
