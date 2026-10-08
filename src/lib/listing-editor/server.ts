import "server-only";
import { cache } from "react";
import { getSessionUser, hasRole, isStaffRole, type SessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ChangeRequest, EditorDocument, EditorMedia, EditorPrice, EditorPrivate, EditorProperty } from "./types";

export type Membership = {
  organization_id: string;
  member_role: "gestor" | "agente";
  can_publish: boolean;
  can_view_all_listings: boolean;
  can_manage_members: boolean;
  can_view_leads: boolean;
  organization: { id: string; name: string; status: "pendiente" | "activa" | "suspendida" } | null;
};

export type SellerContext = { user: SessionUser; memberships: Membership[] };

/** Usuario + organizaciones a las que pertenece (con sus permisos). */
export const getSellerContext = cache(async (): Promise<SellerContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, member_role, can_publish, can_view_all_listings, can_manage_members, can_view_leads, organization:organizations(id, name, status)")
    .eq("user_id", user.id);
  return { user, memberships: (data ?? []) as unknown as Membership[] };
});

export const memberCan = (m: Membership, perm: "publish" | "view_all" | "manage_members" | "view_leads") => {
  if (m.organization?.status === "suspendida") return false;
  switch (perm) {
    case "publish":
      return m.can_publish;
    case "view_all":
      return m.can_view_all_listings || m.member_role === "gestor";
    case "manage_members":
      return m.can_manage_members || m.member_role === "gestor";
    case "view_leads":
      return m.can_view_leads || m.member_role === "gestor";
  }
};

/** ¿Puede crear publicaciones? Rol de vendedor/propietario/agencia, personal, o miembro con permiso de publicar. */
export function canCreateListings(ctx: SellerContext) {
  return hasRole(ctx.user, "vendedor", "propietario", "agencia") || isStaffRole(ctx.user) || ctx.memberships.some((m) => memberCan(m, "publish"));
}

/** ¿Puede editar esta publicación? (refleja public.property_access(…, 'edit')) */
export function canEditListing(ctx: SellerContext, p: Pick<EditorProperty, "owner_user_id" | "organization_id">) {
  if (p.owner_user_id === ctx.user.id) return true;
  return Boolean(p.organization_id && ctx.memberships.some((m) => m.organization_id === p.organization_id && memberCan(m, "manage_members")));
}

export type EditorData = {
  property: EditorProperty;
  priv: EditorPrivate | null;
  prices: EditorPrice[];
  media: EditorMedia[];
  documents: EditorDocument[];
  changeRequests: ChangeRequest[];
  canEdit: boolean;
};

const MEDIA_TTL = 60 * 30;

export async function loadEditorData(id: string): Promise<EditorData | null> {
  const ctx = await getSellerContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!property) return null;
  const [priv, prices, media, docs, crs, access] = await Promise.all([
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_prices").select("*").eq("property_id", id).order("operation"),
    supabase.from("property_media").select("*").eq("property_id", id).order("sort_order").order("created_at"),
    supabase
      .from("property_documents")
      .select("id, doc_type, file_name, mime_type, size_bytes, review_status, review_notes, created_at")
      .eq("property_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("property_change_requests")
      .select("id, status, changes, review_reason, created_at, reviewed_at")
      .eq("property_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.rpc("property_access", { p_property: id, p_level: "edit" }),
  ]);
  const mediaRows = (media.data ?? []) as EditorMedia[];
  const paths = mediaRows.map((m) => m.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("property-media").createSignedUrls(paths, MEDIA_TTL);
    const map = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
    for (const m of mediaRows) m.url = m.storage_path ? map.get(m.storage_path) ?? null : null;
  }
  return {
    property: property as EditorProperty,
    priv: (priv.data as EditorPrivate | null) ?? null,
    prices: (prices.data ?? []) as EditorPrice[],
    media: mediaRows,
    documents: (docs.data ?? []) as EditorDocument[],
    changeRequests: (crs.data ?? []) as ChangeRequest[],
    canEdit: access.data === true,
  };
}

export const pendingRequest = (d: Pick<EditorData, "changeRequests">) => d.changeRequests.find((c) => c.status === "pendiente") ?? null;

/** Valores mostrados en el editor: la versión publicada con los cambios propuestos pendientes encima. */
export function withPendingChanges(d: EditorData) {
  const pending = pendingRequest(d);
  const property = { ...d.property, ...((pending?.changes.property ?? {}) as Partial<EditorProperty>) };
  const priv = d.priv ? { ...d.priv, ...((pending?.changes.private ?? {}) as Partial<EditorPrivate>) } : d.priv;
  const prices = pending?.changes.prices ? (pending.changes.prices as unknown as EditorPrice[]) : d.prices;
  return { property, priv, prices, pending };
}
