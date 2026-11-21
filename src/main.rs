mod helper;
mod workspace;

use futures_util::{StreamExt, future};
use helper::escape_terminal_controls;
use rig_agent::{
    Agent, AgentBuilder,
    agent::{MultiTurnStreamItem, stream_to_stdout},
    streaming::{Item, StreamEvent},
};
use rig_core::{
    completion::{FinishReason, Message},
    message::AssistantContent,
    providers::openai::OpenAIConfig,
};
use rustyline::{DefaultEditor, error::ReadlineError};
use serde_json::json;
use std::{
    env,
    error::Error,
    ffi::OsString,
    io::{self, Write},
    path::PathBuf,
    process::ExitCode,
};
use workspace::Workspace;

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!(
                "Request failed: {}",
                escape_terminal_controls(&error.to_string())
            );
            ExitCode::FAILURE
        }
    }
}

fn parse_workspace(mut args: impl Iterator<Item = OsString>) -> Result<Option<PathBuf>, &'static str> {
    const USAGE: &str = "usage: piarre [--workspace DIRECTORY]. Enter prompts in chat";
    let Some(flag) = args.next() else {
        return Ok(None);
    };
    if flag != "--workspace" {
        return Err(USAGE);
    }
    let directory = args
        .next()
        .filter(|path| !path.is_empty())
        .ok_or("--workspace requires an absolute container directory")?;
    if args.next().is_some() {
        return Err(USAGE);
    }
    Ok(Some(PathBuf::from(directory)))
}

async fn run() -> Result<(), Box<dyn Error>> {
    let directory = parse_workspace(env::args_os().skip(1))?;
    let _workspace = directory
        .as_deref()
        .map(|path| {
            Workspace::select(path)
                .map_err(|error| format!("cannot select workspace {}: {error}", path.display()))
        })
        .transpose()?;

    let endpoint = env::var("PIARRE_ENDPOINT")?;
    let model_name = env::var("PIARRE_MODEL")?;
    if endpoint.trim().is_empty() || model_name.trim().is_empty() {
        return Err("PIARRE_ENDPOINT and PIARRE_MODEL must not be empty".into());
    }
    let model = OpenAIConfig::new("local-no-secret")
        .with_base_url(&endpoint)
        .client()
        .chat(&model_name);
    let agent = AgentBuilder::new(model)
        .temperature(0.0)
        .additional_params(json!({"chat_template_kwargs": {"enable_thinking": false}}))
        .build();
    eprintln!(
        "Model: {}\nEndpoint: {}",
        escape_terminal_controls(&model_name),
        escape_terminal_controls(&endpoint)
    );
    if let Some(directory) = directory {
        eprintln!(
            "Workspace: {}",
            escape_terminal_controls(&directory.to_string_lossy())
        );
    }
    let mut editor = DefaultEditor::new()?;
    let mut history: Vec<Message> = Vec::new();
    eprintln!(
        "Chat history stays in this session. Ctrl-D exits; Ctrl-C clears input or cancels a response."
    );
    loop {
        let input = match editor.readline("You> ") {
            Ok(line) => line,
            Err(ReadlineError::Interrupted) => continue,
            Err(ReadlineError::Eof) => break,
            Err(error) => return Err(error.into()),
        };
        if input.trim().is_empty() {
            continue;
        }
        editor.add_history_entry(input.as_str())?;
        match run_turn(&agent, &history, &input).await {
            Ok(TurnOutcome::Cancelled) => {
                eprintln!("Response cancelled. This turn was not added to conversation history.");
            }
            Ok(TurnOutcome::Completed(messages)) => history.extend(messages),
            Err(error) => {
                eprintln!(
                    "Request failed: {}",
                    escape_terminal_controls(&error.to_string())
                );
            }
        }
    }
    Ok(())
}

enum TurnOutcome {
    Completed(Vec<Message>),
    Cancelled,
}

async fn run_turn(
    agent: &Agent,
    history: &[Message],
    input: &str,
) -> Result<TurnOutcome, Box<dyn Error>> {
    let response = async {
        let mut stream = agent
            .prompt(input)
            .history(history.iter().cloned())
            .stream()
            .filter(|item| {
                future::ready(!matches!(
                    item,
                    Ok(MultiTurnStreamItem::StreamAssistantItem(Item::Event(
                        StreamEvent::End {
                            content: AssistantContent::Reasoning(_),
                            ..
                        }
                    )))
                ))
            })
            .boxed();
        let response = stream_to_stdout(&mut stream).await?;
        if response
            .completion_calls
            .iter()
            .any(|call| matches!(call.finish_reason, Some(FinishReason::Length)))
        {
            return Err("the runtime stopped at its output/context limit; the answer may be incomplete".into());
        }
        if response.output().trim().is_empty() {
            return Err("the model returned no text".into());
        }
        Ok(TurnOutcome::Completed(response.messages))
    };
    let result: Result<TurnOutcome, Box<dyn Error>> = tokio::select! {
        biased;
        signal = tokio::signal::ctrl_c() => signal.map(|()| TurnOutcome::Cancelled).map_err(Into::into),
        result = response => result,
    };
    let separator = {
        let mut stdout = io::stdout().lock();
        stdout.write_all(b"\n").and_then(|_| stdout.flush())
    };
    if result.is_err() {
        eprintln!("Response incomplete. This turn was not added to conversation history.");
    }
    let outcome = result?;
    separator?;
    Ok(outcome)
}
