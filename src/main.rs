mod terminal;

use futures_util::StreamExt;
use rig_core::{
    completion::{CompletionRequest, Message},
    providers::openai::OpenAIConfig,
    streaming::{Item, StreamEvent},
};
use rustyline::{DefaultEditor, error::ReadlineError};
use serde_json::json;
use std::{
    env,
    error::Error,
    io::{self, Write},
    process::ExitCode,
    time::Duration,
};
use terminal::safe_text;

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Request failed: {}", safe_text(&error.to_string()));
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let prompt = env::args().skip(1).collect::<Vec<_>>().join(" ");
    let endpoint = env::var("PIARRE_ENDPOINT")?;
    let model_name = env::var("PIARRE_MODEL")?;
    if endpoint.trim().is_empty() || model_name.trim().is_empty() {
        return Err("PIARRE_ENDPOINT and PIARRE_MODEL must not be empty".into());
    }
    let model = OpenAIConfig::new("local-no-secret")
        .with_base_url(&endpoint)
        .client()
        .chat(&model_name);
    eprintln!(
        "Model: {}\nEndpoint: {}",
        safe_text(&model_name),
        safe_text(&endpoint)
    );
    let interactive = env::args().len() == 1;
    let mut editor = if interactive {
        Some(DefaultEditor::new()?)
    } else {
        None
    };
    let mut history: Vec<Message> = Vec::new();
    if interactive {
        eprintln!("Chat history stays in this session. Ctrl-D exits; Ctrl-C clears input.");
    }
    loop {
        let input = if let Some(editor) = &mut editor {
            match editor.readline("You> ") {
                Ok(line) => line,
                Err(ReadlineError::Interrupted) => continue,
                Err(ReadlineError::Eof) => break,
                Err(error) => return Err(error.into()),
            }
        } else {
            prompt.clone()
        };
        if input.trim().is_empty() {
            if interactive {
                continue;
            }
            return Err("provide a non-empty prompt".into());
        }
        if let Some(editor) = &mut editor {
            editor.add_history_entry(input.as_str())?;
        }
        let request = CompletionRequest::new(input.clone())
            .messages(history.clone())
            .temperature(0.0)
            .max_tokens(128)
            .additional_params(json!({"chat_template_kwargs": {"enable_thinking": false}}));
        let mut displayed = false;
        let result: Result<String, Box<dyn Error>> = async {
            let read = async {
                let mut stream = model.stream(request)?;
                while let Some(item) = stream.next().await {
                    if let Item::Event(StreamEvent::Text { text, .. }) = item? {
                        let safe = safe_text(&text);
                        if !safe.is_empty() {
                            displayed = true;
                            let mut stdout = io::stdout().lock();
                            stdout.write_all(safe.as_bytes())?;
                            stdout.flush()?;
                        }
                    }
                }
                let response = stream.finish().await?;
                let text = response.text();
                if text.trim().is_empty() {
                    return Err("the model returned no text".into());
                }
                Ok::<String, Box<dyn Error>>(text)
            };
            tokio::time::timeout(Duration::from_secs(120), read)
                .await
                .map_err(|_| "local request timed out after 120 seconds; backend work may still be running")?
        }
        .await;
        if displayed {
            println!();
        }
        if result.is_err() && displayed {
            eprintln!("Response incomplete; displayed text was not added to conversation history.");
        }
        match result {
            Ok(text) => {
                history.push(Message::user(input));
                history.push(Message::assistant(text));
            }
            Err(error) if interactive => {
                eprintln!("Request failed: {}", safe_text(&error.to_string()));
            }
            Err(error) => return Err(error),
        }
        if !interactive {
            break;
        }
    }
    Ok(())
}
