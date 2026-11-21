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
        Ok(status) => status,
        Err(error) => {
            eprintln!(
                "Request failed: {}",
                escape_terminal_controls(&error.to_string())
            );
            ExitCode::FAILURE
        }
    }
}

struct Invocation {
    directory: Option<PathBuf>,
    prompt: Option<String>,
}

impl Invocation {
    fn parse(args: impl Iterator<Item = OsString>) -> Result<Self, &'static str> {
        let mut args = args.peekable();
        let directory = if args.peek().is_some_and(|arg| arg == "--workspace") {
            args.next();
            let directory = args
                .next()
                .filter(|path| !path.is_empty())
                .ok_or("--workspace requires an absolute container directory")?;
            Some(PathBuf::from(directory))
        } else {
            None
        };
        let prompt_args = args
            .map(|arg| arg.into_string().map_err(|_| "prompt must be valid UTF-8"))
            .collect::<Result<Vec<_>, _>>()?;
        let prompt = (!prompt_args.is_empty()).then(|| prompt_args.join(" "));
        Ok(Self { directory, prompt })
    }
}

async fn run() -> Result<ExitCode, Box<dyn Error>> {
    let Invocation { directory, prompt } = Invocation::parse(env::args_os().skip(1))?;
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
    let interactive = prompt.is_none();
    let prompt = prompt.unwrap_or_default();
    let mut editor = if interactive {
        Some(DefaultEditor::new()?)
    } else {
        None
    };
    let mut history: Vec<Message> = Vec::new();
    if interactive {
        eprintln!(
            "Chat history stays in this session. Ctrl-D exits; Ctrl-C clears input or cancels a response."
        );
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
        match run_turn(&agent, &history, &input).await {
            Ok(TurnOutcome::Cancelled) => {
                eprintln!("Response cancelled. This turn was not added to conversation history.");
                if !interactive {
                    return Ok(ExitCode::FAILURE);
                }
            }
            Ok(TurnOutcome::Completed(messages)) => history.extend(messages),
            Err(error) if interactive => {
                eprintln!(
                    "Request failed: {}",
                    escape_terminal_controls(&error.to_string())
                );
            }
            Err(error) => return Err(error),
        }
        if !interactive {
            break;
        }
    }
    Ok(ExitCode::SUCCESS)
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
