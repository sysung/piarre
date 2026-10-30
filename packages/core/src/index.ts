export interface ProjectSnapshot {
  readonly projectId: string;
  readonly repositoryUri: string;
  readonly name: string;
  readonly revision: number;
}

export interface ProjectCommand {
  readonly commandId: string;
  readonly projectId: string;
  readonly expectedProjectRevision: number;
  readonly action: { readonly kind: "rename-project"; readonly name: string };
}

export type ProjectEvent =
  | {
      readonly kind: "project-created";
      readonly projectId: string;
      readonly repositoryUri: string;
      readonly name: string;
    }
  | { readonly kind: "project-renamed"; readonly name: string };

export type CommandResult =
  | {
      readonly kind: "applied" | "duplicate";
      readonly snapshot: ProjectSnapshot;
    }
  | { readonly kind: "stale"; readonly actualRevision: number }
  | { readonly kind: "command-conflict" | "wrong-project" };

export function replay(events: readonly ProjectEvent[]): ProjectSnapshot {
  let snapshot: ProjectSnapshot | undefined;
  for (const event of events) {
    if (event.kind === "project-created") {
      if (snapshot)
        throw new Error("Invalid project history: repeated creation");
      snapshot = {
        projectId: event.projectId,
        repositoryUri: event.repositoryUri,
        name: event.name,
        revision: 1,
      };
    } else {
      if (!snapshot)
        throw new Error("Invalid project history: missing creation");
      snapshot = {
        ...snapshot,
        name: event.name,
        revision: snapshot.revision + 1,
      };
    }
  }
  if (!snapshot) throw new Error("Invalid project history: empty log");
  return snapshot;
}
