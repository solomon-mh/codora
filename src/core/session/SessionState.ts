export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number | null;
  /** Active coding time in ms, excluding idle gaps. */
  activeMs: number;
  filesTouched: string[];
  languages: string[];
  meaningfulChanges: number;
  gitChangesDetected: boolean;
}

export interface LiveSessionState {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  activeMs: number;
  msSinceLastChallenge: number;
  filesTouched: Set<string>;
  languages: Set<string>;
  meaningfulChanges: number;
  gitChangesDetected: boolean;
}
