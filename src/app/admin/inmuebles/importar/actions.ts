"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { staffCtx } from "@/lib/admin/server";
import { fetchRemoteImage } from "@/lib/import/fetch-image";
import { importRowSchema, normalizeSource, type ImportRow } from "@/lib/import/listings";
import { dbErrorMessage } from "@/lib/security";

export type ImportResult =
  | { status: "ok"; id: string; code: string; photos: number; photoErrors: string[] }
  | { status: "duplicate"; id: string; code: string }
  | { status: "error"; message: string };

const optionsSchema = z.object({
  source: z.string().trim().min(2, "Indique la empresa de origen").max(120),
  authorized: z.literal(true, { error: "Confirme que tiene autorización escrita de la empresa" }),
});

const todayDR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });

/** Crea un inmueble importado (borrador de MAJ) con precios, datos de origen y fotos descargadas de sus enlaces. */
export async function importListingRow(input: { row: ImportRow; source: string; authorized: boolean }): Promise<ImportResult> {
  const { supabase, user } = await staffCtx("/admin/inmuebles/importar");
  const opts = optionsSchema.safeParse({ source: input.source, authorized: input.authorized });
  if (!opts.success) return { status: "error", message: opts.error.issues[0]?.message ?? "Datos no válidos." };
  const parsed = importRowSchema.safeParse(input.row);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Fila no válida." };
  const row = parsed.data;
  const source = normalizeSource(opts.data.source);
  const ref = row.referencia || null;

  if (ref) {
    const { data: dup } = await supabase.from("properties").select("id, code").eq("external_source", source).eq("external_ref", ref).maybeSingle();
    if (dup) return { status: "duplicate", id: dup.id, code: dup.code };
  }

  const { data: created, error } = await supabase.from("properties").insert({
    title: row.titulo,
    operation: row.operacion,
    property_type: row.tipo,
    description: row.descripcion ?? "",
    province: row.provincia ?? "",
    municipality: row.municipio ?? "",
    sector: row.sector ?? "",
    bedrooms: row.habitaciones ?? null,
    bathrooms: row.banos ?? null,
    half_bathrooms: row.medios_banos ?? null,
    parking_spaces: row.parqueos ?? null,
    built_area_m2: row.area_construida_m2 ?? null,
    land_area_m2: row.area_terreno_m2 ?? null,
    owner_user_id: user.id,
    is_maj_listing: true,
    status: "borrador",
    external_source: source,
    external_ref: ref,
  }).select("id, code").single();
  if (error?.code === "23505" && ref) {
    const { data: dup } = await supabase.from("properties").select("id, code").eq("external_source", source).eq("external_ref", ref).maybeSingle();
    if (dup) return { status: "duplicate", id: dup.id, code: dup.code };
  }
  if (error || !created) return { status: "error", message: dbErrorMessage(error) };
  const id = created.id as string;

  const prices = [
    ...(row.precio_venta !== undefined && row.operacion !== "renta" ? [{ operation: "venta", amount: row.precio_venta }] : []),
    ...(row.precio_renta !== undefined && row.operacion !== "venta" ? [{ operation: "renta", amount: row.precio_renta }] : []),
  ].map((p) => ({ ...p, property_id: id, currency: row.moneda }));
  const problems: string[] = [];
  if (prices.length) {
    const { error: e } = await supabase.from("property_prices").insert(prices);
    if (e) problems.push(`Precio no guardado: ${dbErrorMessage(e)}`);
  }

  const today = todayDR();
  const { error: privErr } = await supabase.from("property_private").update({
    publisher_relationship: "agente",
    publication_authorized: true,
    authorization_date: today,
    staff_notes: `Importado de «${opts.data.source}»${ref ? ` (referencia ${ref})` : ""} el ${today} por ${user.email}. Autorización escrita de la empresa confirmada al importar.`,
  }).eq("property_id", id).select("property_id");
  if (privErr) problems.push(`Datos de origen no guardados: ${dbErrorMessage(privErr)}`);

  // Fotos: descarga de 4 en 4 y se guardan en el orden del archivo.
  const results: ({ path: string } | { error: string })[] = new Array(row.fotos.length);
  for (let i = 0; i < row.fotos.length; i += 4) {
    await Promise.all(row.fotos.slice(i, i + 4).map(async (url, k) => {
      const n = i + k;
      try {
        const img = await fetchRemoteImage(url);
        const path = `properties/${id}/importada-${String(n + 1).padStart(2, "0")}-${crypto.randomUUID()}.${img.ext}`;
        const up = await supabase.storage.from("property-media").upload(path, img.bytes, { contentType: img.contentType, upsert: false });
        if (up.error) throw new Error("No se pudo guardar");
        results[n] = { path };
      } catch (e) {
        results[n] = { error: `Foto ${n + 1}: ${(e as Error).message}` };
      }
    }));
  }
  const saved = results.flatMap((r) => ("path" in r ? [r.path] : []));
  const photoErrors = [...problems, ...results.flatMap((r) => ("error" in r ? [r.error] : []))];
  let photos = saved.length;
  if (saved.length) {
    const { error: mErr } = await supabase.from("property_media").insert(saved.map((path, i) => ({
      property_id: id, kind: "foto", storage_path: path, alt_text: `${row.titulo} – foto ${i + 1}`.slice(0, 200),
      sort_order: i, is_cover: i === 0, created_by: user.id,
    })));
    if (mErr) {
      await supabase.storage.from("property-media").remove(saved);
      photos = 0;
      photoErrors.push(`Fotos no registradas: ${dbErrorMessage(mErr)}`);
    }
  }
  if (row.video) {
    const { error: vErr } = await supabase.from("property_media").insert({
      property_id: id, kind: "video", external_url: row.video, alt_text: `Video de ${row.titulo}`.slice(0, 200), sort_order: saved.length, created_by: user.id,
    });
    if (vErr) photoErrors.push(`Video no guardado: ${dbErrorMessage(vErr)}`);
  }

  revalidatePath("/admin/inmuebles");
  return { status: "ok", id, code: created.code as string, photos, photoErrors };
}
