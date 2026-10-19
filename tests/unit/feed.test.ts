import { describe, expect, it } from "vitest";
import { buildMetaFeed, type FeedListing } from "@/lib/catalog/feed";

const base: FeedListing = {
  id: "1", code: "MAJ-001001", title: "Apartamento & vista", description: "Lindo <apto>", operation: "venta",
  property_type: "apartamento", province: "Santo Domingo", municipality: "Santo Domingo Este", sector: "Ensanche Ozama",
  approx_lat: "18.48", approx_lng: "-69.85", public_address: null, bedrooms: 3, bathrooms: 2, built_area_m2: "120",
  land_area_m2: null, year_built: null, sale_price: "150000.00", sale_currency: "USD", rent_price: null, rent_currency: null,
  url: "https://x.do/inmuebles/maj-001001", images: ["https://x.do/feeds/foto/a"],
};
const opts = { title: "MAJ", selfUrl: "https://x.do/feeds/facebook.xml" };

describe("Feed de Meta", () => {
  it("genera una entrada válida y escapa el texto", () => {
    const xml = buildMetaFeed([base], opts);
    expect(xml).toContain("<home_listing_id>MAJ-001001</home_listing_id>");
    expect(xml).toContain("<price>150000 USD</price>");
    expect(xml).toContain("<availability>for_sale</availability>");
    expect(xml).toContain("<property_type>apartment</property_type>");
    expect(xml).toContain("Apartamento &amp; vista");
    expect(xml).toContain("Lindo &lt;apto&gt;");
    expect(xml).not.toContain("<apto>");
  });
  it("venta y renta generan dos entradas con códigos distintos", () => {
    const xml = buildMetaFeed([{ ...base, operation: "ambas", rent_price: "1200", rent_currency: "USD" }], opts);
    expect(xml).toContain("<home_listing_id>MAJ-001001-V</home_listing_id>");
    expect(xml).toContain("<home_listing_id>MAJ-001001-R</home_listing_id>");
    expect(xml).toContain("<availability>for_rent</availability>");
  });
  it("omite propiedades sin foto o sin precio", () => {
    expect(buildMetaFeed([{ ...base, images: [] }], opts)).not.toContain("<listing>");
    expect(buildMetaFeed([{ ...base, sale_price: null }], opts)).not.toContain("<listing>");
  });
});
