import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { selectableConversationSources } from "./conversation-controller.js";
import { captureRepositorySkill, discoverRepositorySkills } from "./repository-skills.js";

export function conversationContextCatalog(project: ProjectSnapshot) {
  const records = selectableConversationSources(project).map(source => ({
    id: source.reference.recordId, type: source.reference.kind, label: source.text.slice(0, 120),
  }));
  try {
    const skills = discoverRepositorySkills(project).map(skill => ({ id: `skill-file:${skill.path}`, type: "skill", label: skill.label }));
    return { sources: [...records, ...skills], skillStatus: "No eligible repository skills found. Skills are referenced as text, never run automatically." };
  } catch {
    return { sources: records, skillStatus: "Repository skills could not be read. Check workspace access and try reopening Piarre." };
  }
}

export function resolveConversationContext(project: ProjectSnapshot, ids: readonly string[]): readonly SuppliedSource[] {
  if (ids.length > 15 || new Set(ids).size !== ids.length) throw new Error("Choose at most 15 distinct references");
  const records = selectableConversationSources(project);
  return ids.map(id => {
    if (id.startsWith("skill-file:")) return captureRepositorySkill(project, id.slice("skill-file:".length));
    const source = records.find(source => source.reference.recordId === id);
    if (!source) throw new Error("Selected source is no longer available");
    return source;
  });
}
