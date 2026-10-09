// Estado estándar de las acciones de servidor: nunca se informa "ok" sin confirmación de la base de datos.
export type ActionState = { status: "idle" } | { status: "ok"; message: string; id?: string } | { status: "error"; message: string; errors?: Record<string, string> };
export const idle: ActionState = { status: "idle" };
