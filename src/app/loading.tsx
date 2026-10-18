import { getI18n } from "@/i18n/server";

export default async function Loading() {
  const { d } = await getI18n();
  return <div className="container section center muted" role="status">{d.common.loading}</div>;
}
