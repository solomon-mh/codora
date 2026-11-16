/**
 * Parses `git status --porcelain -z` into the paths of files that exist
 * and changed: modified, added, renamed, copied or untracked. Deleted
 * files are left out, since there is no code left to ask about.
 *
 * The -z form is used because it is the only one that is safe to parse:
 * entries are NUL-separated, paths are never quoted or escaped (spaces,
 * unicode), and nothing may be trimmed — each entry is exactly
 * `XY path`, where X or Y is often a space (` M path` is the common
 * "edited, not staged" case). A rename or copy is followed by a second
 * entry holding the original path, which is skipped.
 */
export function parsePorcelainZ(output: string): string[] {
  const entries = output.split('\0');
  const paths: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4) continue;

    const x = entry[0];
    const y = entry[1];
    const filePath = entry.slice(3);

    // The next entry is the rename/copy source, not a change of its own.
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') i++;

    if (x === 'D' || y === 'D') continue;
    paths.push(filePath);
  }

  return paths;
}
