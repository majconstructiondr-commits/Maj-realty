import { expect, test } from "@playwright/test";

test("visitante busca, conserva filtros al volver y consulta por WhatsApp con referencia y enlace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Comprar" }).click();
  await page.getByLabel("Provincia").first().selectOption("Distrito Nacional");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/\/venta\?.*provincia=Distrito/);
  const first = page.locator("a.listing-card").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator("h1")).toBeVisible();
  const wa = page.locator('a[href^="https://wa.me/"]').filter({ hasText: "Consultar por WhatsApp" }).first();
  const href = await wa.getAttribute("href");
  const text = decodeURIComponent(href!.split("?text=")[1]);
  expect(text).toMatch(/referencia [A-Z]+-\d+/);
  expect(text).toMatch(/enlace https?:\/\/\S+\/inmuebles\//);
  await page.getByRole("link", { name: "← Volver a los resultados" }).click();
  await expect(page).toHaveURL(/provincia=Distrito/);
  await expect(page.getByLabel("Provincia")).toHaveValue("Distrito Nacional");
});

test("sin resultados se ofrece una alternativa de contacto", async ({ page }) => {
  await page.goto("/venta?q=zzzz-no-existe");
  await expect(page.getByText("No encontramos inmuebles con esos filtros")).toBeVisible();
  await expect(page.getByRole("link", { name: "Busco una propiedad" }).first()).toBeVisible();
});

test("la ficha separa los datos en cajas y distingue desconocido y no aplica", async ({ page }) => {
  await page.goto("/inmuebles/demo-000003");
  await expect(page).toHaveURL(/demo-000003-/);
  const hab = page.locator(".box", { hasText: "Habitaciones" }).first();
  await expect(hab).toContainText("No aplica");
  await expect(page.getByText("Precio de venta")).toBeVisible();
});

test("no hay confirmaciones falsas cuando no se guarda", async ({ page }) => {
  await page.goto("/contacto");
  await page.getByLabel("Nombre completo").fill("Prueba Automática");
  await page.getByLabel("Correo electrónico").fill("prueba@example.com");
  await page.getByLabel("Mensaje").fill("Mensaje de prueba");
  await page.getByLabel(/Autorizo a MAJ REALTY/).check();
  await page.waitForTimeout(2700);
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Solicitud registrada")).toHaveCount(0);
});

test("sin desplazamiento horizontal en las páginas principales", async ({ page }) => {
  for (const p of ["/", "/venta", "/renta?vista=lista", "/inmuebles/demo-000001-demo-apartamento-en-sector-urbano", "/remodelaciones", "/gestiones-legales", "/publica-tu-propiedad", "/calculadora-hipotecaria", "/legal/privacidad"]) {
    await page.goto(p, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

test("navegación con teclado: enlace para saltar al contenido", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
});

test("paneles fuera de buscadores", async ({ request }) => {
  const r = await request.get("/robots.txt");
  expect(await r.text()).toContain("Disallow: /");
});
