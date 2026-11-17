// Shapes returned by the Express API (column names match the database).

export type Workspace = {
  id: string
  user_id: string
  name: string
  created_at: string
}

/** GET /api/profile */
export type Profile = {
  user: { id: string; email?: string }
  last_workspace_id: string | null
}
