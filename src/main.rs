mod terminal;

use futures_util::StreamExt;
use rig_core::{
    completion::{CompletionRequest, FinishReason, Message},
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
        eprintln!("Chat history stays in this session. Ctrl-D exits; Ctrl-C clears input or cancels a response.");
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
            .additional_params(json!({"chat_template_kwargs": {"enable_thinking": false}}));
        let mut displayed = false;
        let response = async {
            let mut stream = model.stream(request)?;
            while let Some(item) = stream.next().await {
                if let Item::Event(StreamEvent::Text { text, .. }) = item? {
                    let safe = safe_text(&text);
                    if !safe.is_empty() {
                        let mut stdout = io::stdout().lock();
                        stdout.write_all(safe.as_bytes())?;
                        displayed = true;
                        stdout.flush()?;
                    }
                }
            }
            let response = stream.finish().await?;
            if matches!(response.finish_reason(), Some(FinishReason::Length)) {
                return Err("the runtime stopped at its output/context limit; the answer may be incomplete".into());
            }
            let text = response.text();
            if text.trim().is_empty() {
                return Err("the model returned no text".into());
            }
            Ok::<String, Box<dyn Error>>(text)
        };
        let mut result: Result<String, Box<dyn Error>> = tokio::select! {
            biased;
            signal = tokio::signal::ctrl_c() => {
                signal?;
                Err("cancelled locally; the model server may still be generating. This turn was not added to conversation history".into())
            }
            result = response => result,
        };
        if displayed {
            let mut stdout = io::stdout().lock();
            let separator = stdout.write_all(b"\n").and_then(|_| stdout.flush());
            if let Err(error) = separator {
                if result.is_ok() {
                    result = Err(error.into());
                }
            }
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
