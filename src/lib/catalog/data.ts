import "server-only";
import { cache } from "react";
import { hasSupabase } from "../env";
import { createClient } from "../supabase/server";
import { demoListings, demoMedia, demoPrices } from "../demo/data";
import { PAGE_SIZE, type SearchFilters } from "./search";
import type { CatalogListing, CatalogMedia, CatalogPrice } from "./types";

export type SearchResult = { items: CatalogListing[]; total: number; page: number; pages: number; demo: boolean; error?: string };

const SIGNED_TTL = 60 * 60; // 1 hora

async function signPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length || !hasSupabase) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("property-media").createSignedUrls(unique, SIGNED_TTL);
  const map = new Map<string, string>();
  for (const d of data ?? []) if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  return map;
}

function priceCols(operation: "venta" | "renta") {
  return operation === "venta"
    ? { price: "sale_price", currency: "sale_currency" }
    : { price: "rent_price", currency: "rent_currency" };
}

/** Filtro en memoria equivalente (modo demostración). */
function filterDemo(operation: "venta" | "renta", f: SearchFilters) {
  const { price, currency } = priceCols(operation);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let items = demoListings.filter((l) => l.operation === operation || l.operation === "ambas");
  if (f.q) items = items.filter((l) => norm(`${l.code} ${l.title} ${l.sector}`).includes(norm(f.q!)));
  if (f.provincia) items = items.filter((l) => l.province === f.provincia);
  if (f.municipio) items = items.filter((l) => norm(l.municipality).includes(norm(f.municipio!)));
  if (f.sector) items = items.filter((l) => norm(l.sector).includes(norm(f.sector!)));
  if (f.tipo) items = items.filter((l) => l.property_type === f.tipo);
  const p = (l: CatalogListing) => (l[price as keyof CatalogListing] as string | null) ?? null;
  if (f.moneda) items = items.filter((l) => l[currency as keyof CatalogListing] === f.moneda);
  if (f.min !== undefined) items = items.filter((l) => p(l) !== null && Number(p(l)) >= f.min!);
  if (f.max !== undefined) items = items.filter((l) => p(l) !== null && Number(p(l)) <= f.max!);
  if (f.hab !== undefined) items = items.filter((l) => (l.bedrooms ?? -1) >= f.hab!);
  if (f.banos !== undefined) items = items.filter((l) => (l.bathrooms ?? -1) >= f.banos!);
  if (f.parqueos !== undefined) items = items.filter((l) => (l.parking_spaces ?? -1) >= f.parqueos!);
  if (f.m2 !== undefined) items = items.filter((l) => Number(l.built_area_m2 ?? l.land_area_m2 ?? -1) >= f.m2!);
  for (const k of f.car) items = items.filter((l) => l.features[k]?.v === "si");
  if (f.orden === "recientes") items.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  else {
    const dir = f.orden === "precio_asc" ? 1 : -1;
    items.sort((a, b) => {
      const ca = String(a[currency as keyof CatalogListing] ?? "");
      const cb = String(b[currency as keyof CatalogListing] ?? "");
      if (ca !== cb) return ca.localeCompare(cb);
      return dir * (Number(p(a) ?? Infinity) - Number(p(b) ?? Infinity));
    });
  }
  return items;
}

export async function searchCatalog(operation: "venta" | "renta", f: SearchFilters): Promise<SearchResult> {
  const from = (f.pagina - 1) * PAGE_SIZE;
  if (!hasSupabase) {
    const all = filterDemo(operation, f);
    return { items: all.slice(from, from + PAGE_SIZE), total: all.length, page: f.pagina, pages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)), demo: true };
  }
  const { price, currency } = priceCols(operation);
  const supabase = await createClient();
  let q = supabase.from("catalog").select("*", { count: "exact" }).in("operation", [operation, "ambas"]);
  if (f.q) {
    const term = f.q.replace(/[%,()*]/g, " ").trim();
    if (term) q = q.or(`code.ilike.%${term}%,title.ilike.%${term}%,sector.ilike.%${term}%`);
  }
  if (f.provincia) q = q.eq("province", f.provincia);
  if (f.municipio) q = q.ilike("municipality", `%${f.municipio.replace(/[%*]/g, "")}%`);
  if (f.sector) q = q.ilike("sector", `%${f.sector.replace(/[%*]/g, "")}%`);
  if (f.tipo) q = q.eq("property_type", f.tipo);
  if (f.moneda) q = q.eq(currency, f.moneda);
  if (f.min !== undefined) q = q.gte(price, f.min);
  if (f.max !== undefined) q = q.lte(price, f.max);
  if (f.hab !== undefined) q = q.gte("bedrooms", f.hab);
  if (f.banos !== undefined) q = q.gte("bathrooms", f.banos);
  if (f.parqueos !== undefined) q = q.gte("parking_spaces", f.parqueos);
  if (f.m2 !== undefined) q = q.or(`built_area_m2.gte.${f.m2},land_area_m2.gte.${f.m2}`);
  if (f.car.length) q = q.contains("features", Object.fromEntries(f.car.map((k) => [k, { v: "si" }])));
  if (f.orden === "recientes") q = q.order("published_at", { ascending: false, nullsFirst: false });
  else
    q = q
      .order(currency, { ascending: true, nullsFirst: false })
      .order(price, { ascending: f.orden === "precio_asc", nullsFirst: false });
  q = q.order("id").range(from, from + PAGE_SIZE - 1);
  const { data, count, error } = await q;
  if (error) return { items: [], total: 0, page: f.pagina, pages: 1, demo: false, error: "No pudimos cargar el catálogo. Intente de nuevo." };
  const items = (data ?? []) as CatalogListing[];
  const urls = await signPaths(items.map((i) => i.cover_path ?? ""));
  for (const i of items) i.cover_url = i.cover_path ? urls.get(i.cover_path) ?? null : null;
  const total = count ?? items.length;
  return { items, total, page: f.pagina, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), demo: false };
}

export const getListingByCode = cache(async (code: string) => {
  if (!hasSupabase) {
    const l = demoListings.find((x) => x.code.toLowerCase() === code.toLowerCase());
    if (!l) return null;
    return { listing: l, prices: demoPrices(l.id), media: demoMedia(), demo: true };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("catalog").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!data) return null;
  const listing = data as CatalogListing;
  const [{ data: prices }, { data: media }] = await Promise.all([
    supabase.from("catalog_prices").select("*").eq("property_id", listing.id),
    supabase.from("catalog_media").select("*").eq("property_id", listing.id).order("is_cover", { ascending: false }).order("sort_order"),
  ]);
  const m = (media ?? []) as CatalogMedia[];
  const urls = await signPaths(m.map((x) => x.storage_path ?? ""));
  for (const x of m) x.url = x.storage_path ? urls.get(x.storage_path) ?? null : x.external_url;
  return { listing, prices: (prices ?? []) as CatalogPrice[], media: m, demo: false };
});

export async function featuredListings(limit = 6): Promise<{ items: CatalogListing[]; demo: boolean }> {
  if (!hasSupabase) return { items: demoListings.slice(0, limit), demo: true };
  const supabase = await createClient();
  const { data } = await supabase.from("catalog").select("*").order("published_at", { ascending: false }).limit(limit);
  const items = (data ?? []) as CatalogListing[];
  const urls = await signPaths(items.map((i) => i.cover_path ?? ""));
  for (const i of items) i.cover_url = i.cover_path ? urls.get(i.cover_path) ?? null : null;
  return { items, demo: false };
}

export async function latestExchangeRate() {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("exchange_rates")
    .select("base, quote, rate, source, rate_date")
    .order("rate_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { base: "USD" | "DOP"; quote: "USD" | "DOP"; rate: string; source: string; rate_date: string } | null;
}

export async function publicCodesForSitemap() {
  if (!hasSupabase) return [] as { code: string; slug: string; updated_at: string }[];
  const supabase = await createClient();
  const { data } = await supabase.from("catalog").select("code, slug, updated_at").eq("is_demo", false).limit(5000);
  return (data ?? []) as { code: string; slug: string; updated_at: string }[];
}
