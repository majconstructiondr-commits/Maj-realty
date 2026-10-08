/** Una conversación tiene mensajes sin leer si el último mensaje es posterior a la última lectura. */
export function isUnread(lastMessageAt: string | null | undefined, lastReadAt: string | null | undefined): boolean {
  if (!lastMessageAt) return false;
  if (!lastReadAt) return true;
  return new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime();
}
