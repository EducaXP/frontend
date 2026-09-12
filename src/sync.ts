import type { Draft, Operation, Submission } from "./types";

export function queueDraft(draft: Draft, channel: Operation["channel"]): Draft {
  if (draft.pending)
    return {
      ...draft,
      status: draft.status === "conflict" ? "conflict" : "queued",
      retryAt: 0,
      error: undefined,
    };
  return {
    ...draft,
    status: "queued",
    error: undefined,
    pending: {
      operationId: crypto.randomUUID(),
      submissionId: draft.submissionId,
      missionId: draft.missionId,
      groupId: draft.groupId,
      baseVersion: draft.baseVersion,
      evidence: draft.evidence,
      reflection: draft.reflection,
      completedSteps: [...draft.completedSteps],
      channel,
    },
  };
}
export function applyReceipt(
  draft: Draft,
  operationId: string,
  received: Submission,
): Draft {
  if (draft.pending?.operationId !== operationId) return draft;
  const sent = draft.pending;
  const unchanged =
    draft.evidence === sent.evidence &&
    draft.reflection === sent.reflection &&
    JSON.stringify([...draft.completedSteps].sort()) ===
      JSON.stringify([...sent.completedSteps].sort());
  return {
    ...draft,
    submissionId: received.id,
    baseVersion: Math.max(draft.baseVersion, received.version),
    pending: undefined,
    conflict: undefined,
    error: undefined,
    attempts: 0,
    retryAt: 0,
    status: unchanged ? "synced" : "local",
  };
}
export function fromSubmission(submission: Submission): Draft {
  return {
    missionId: submission.missionId,
    groupId: submission.groupId,
    submissionId: submission.id,
    baseVersion: submission.version,
    evidence: submission.evidence,
    reflection: submission.reflection,
    completedSteps: submission.completedSteps,
    status: "synced",
  };
}
export function emptyDraft(missionId: string, groupId: string): Draft {
  return {
    missionId,
    groupId,
    submissionId: crypto.randomUUID(),
    baseVersion: 0,
    evidence: "",
    reflection: "",
    completedSteps: [],
    status: "local",
  };
}
export const hasWork = (draft: Draft) =>
  !!draft.pending ||
  (draft.status !== "synced" &&
    !!(draft.evidence || draft.reflection || draft.completedSteps.length));
