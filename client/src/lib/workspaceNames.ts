// Workspace names are unique per user, ignoring case and surrounding spaces.
// The server enforces the same rule; this copy lets the dialog warn while typing.

export function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// The name a new workspace starts with: "Default", then "Default_2", "Default_3", …
export function nextDefaultName(takenNames: string[]) {
  const isTaken = (name: string) => takenNames.some((taken) => sameName(taken, name))
  if (!isTaken('Default')) return 'Default'
  let n = 2
  while (isTaken(`Default_${n}`)) n++
  return `Default_${n}`
}
