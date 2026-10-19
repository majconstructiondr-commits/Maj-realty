// Mensajes de la importación desde Excel (lib/import y /admin/inmuebles/importar).
// Módulo pequeño y sin dependencias: la validación de filas corre también en el navegador,
// así que no debe cargar el diccionario completo.
import { fmt } from "../fmt";

export const importMsgEs = {
  msg: {
    invalidUrl: "Enlace no válido",
    httpsRequired: "El enlace debe empezar por https://",
    integer: "Debe ser un número entero",
    negative: "No puede ser negativo",
    titleMin: "El título debe tener al menos 5 caracteres",
    titleMax: "Título muy largo (máx. 140)",
    operation: "Operación no válida (venta, renta o ambas)",
    type: "Tipo no válido",
    currency: "Moneda no válida (DOP o USD)",
    descriptionMax: "Descripción muy larga (máx. 8000)",
    currencyRequired: "Indique la moneda del precio (DOP o USD)",
    saleOnRent: "Tiene precio de venta pero la operación es renta",
    rentOnSale: "Tiene precio de renta pero la operación es venta",
    notNumber: "debe ser un número",
    noHeader: "No se encontró la fila de encabezados (debe tener al menos la columna «titulo»).",
    noRows: "El archivo no tiene inmuebles debajo de los encabezados.",
    untitled: "(sin título)",
    httpsOnly: "El enlace debe ser https",
    notAllowed: "Enlace no permitido",
    noRedirectTarget: "Redirección sin destino",
    notImage: "No es una imagen JPG, PNG o WebP",
    imageTooLarge: "Imagen de más de 10 MB",
    emptyImage: "Imagen vacía",
    tooManyRedirects: "Demasiadas redirecciones",
    notSaved: "No se pudo guardar",
    sourceRequired: "Indique la empresa de origen",
    authRequired: "Confirme que tiene autorización escrita de la empresa",
    invalidData: "Datos no válidos.",
    invalidRow: "Fila no válida.",
    fileTooLarge: "El archivo pesa más de 5 MB.",
    unreadable: "No se pudo leer el archivo. Use .xlsx o .csv.",
    connection: "Error de conexión. Vuelva a intentar: las filas ya importadas no se duplican si tienen referencia.",
  },
  // Mensajes con variables.
  tpl: {
    maxPhotos: "Máximo {n} fotos por inmueble",
    maxRows: "Máximo {n} inmuebles por archivo. Divida el archivo.",
    serverStatus: "El servidor respondió {n}",
    photo: "Foto {n}: {msg}",
    priceNotSaved: "Precio no guardado: {msg}",
    sourceNotSaved: "Datos de origen no guardados: {msg}",
    photosNotSaved: "Fotos no registradas: {msg}",
    videoNotSaved: "Video no guardado: {msg}",
  },
  // Nombres de columna que encabezan los errores de fila ("Título: …").
  fields: {
    titulo: "Título", operacion: "Operación", tipo: "Tipo", precio_venta: "Precio de venta", precio_renta: "Precio de renta",
    moneda: "Moneda", habitaciones: "Habitaciones", banos: "Baños", medios_banos: "Medios baños", parqueos: "Parqueos",
    area_construida_m2: "Área construida", area_terreno_m2: "Área de terreno", descripcion: "Descripción", fotos: "Fotos", video: "Video",
    referencia: "Referencia", provincia: "Provincia", municipio: "Municipio", sector: "Sector",
  } as Record<string, string>,
};

export type ImportMsgDict = typeof importMsgEs;

export const importMsgEn: ImportMsgDict = {
  msg: {
    invalidUrl: "Invalid link",
    httpsRequired: "The link must start with https://",
    integer: "Must be a whole number",
    negative: "Cannot be negative",
    titleMin: "The title must be at least 5 characters long",
    titleMax: "Title too long (max. 140)",
    operation: "Invalid operation (venta, renta or ambas)",
    type: "Invalid type",
    currency: "Invalid currency (DOP or USD)",
    descriptionMax: "Description too long (max. 8000)",
    currencyRequired: "Enter the price currency (DOP or USD)",
    saleOnRent: "It has a sale price but the operation is rent",
    rentOnSale: "It has a rent price but the operation is sale",
    notNumber: "must be a number",
    noHeader: "The header row was not found (it must have at least the «titulo» column).",
    noRows: "The file has no properties below the headers.",
    untitled: "(untitled)",
    httpsOnly: "The link must be https",
    notAllowed: "Link not allowed",
    noRedirectTarget: "Redirect without a target",
    notImage: "Not a JPG, PNG or WebP image",
    imageTooLarge: "Image larger than 10 MB",
    emptyImage: "Empty image",
    tooManyRedirects: "Too many redirects",
    notSaved: "Could not be saved",
    sourceRequired: "Enter the source company",
    authRequired: "Confirm that you have written authorization from the company",
    invalidData: "Invalid data.",
    invalidRow: "Invalid row.",
    fileTooLarge: "The file is larger than 5 MB.",
    unreadable: "The file could not be read. Use .xlsx or .csv.",
    connection: "Connection error. Try again: rows already imported are not duplicated if they have a reference.",
  },
  tpl: {
    maxPhotos: "Maximum {n} photos per property",
    maxRows: "Maximum {n} properties per file. Split the file.",
    serverStatus: "The server responded {n}",
    photo: "Photo {n}: {msg}",
    priceNotSaved: "Price not saved: {msg}",
    sourceNotSaved: "Source data not saved: {msg}",
    photosNotSaved: "Photos not recorded: {msg}",
    videoNotSaved: "Video not saved: {msg}",
  },
  fields: {
    titulo: "Title", operacion: "Operation", tipo: "Type", precio_venta: "Sale price", precio_renta: "Rent price",
    moneda: "Currency", habitaciones: "Bedrooms", banos: "Bathrooms", medios_banos: "Half bathrooms", parqueos: "Parking spaces",
    area_construida_m2: "Built area", area_terreno_m2: "Land area", descripcion: "Description", fotos: "Photos", video: "Video",
    referencia: "Reference", provincia: "Province", municipio: "Municipality", sector: "Sector",
  },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Traduce un mensaje de importación (en español) con los textos de `to`. Reconoce los mensajes fijos,
 * los que llevan variables y el prefijo de columna ("Título: …"); lo desconocido se devuelve igual.
 */
export function localizeImportMessage(msg: string, to: ImportMsgDict): string {
  if (to === importMsgEs) return msg;
  const S = importMsgEs;
  const fixed = (Object.keys(S.msg) as (keyof ImportMsgDict["msg"])[]).find((k) => S.msg[k] === msg);
  if (fixed) return to.msg[fixed];
  for (const k of Object.keys(S.tpl) as (keyof ImportMsgDict["tpl"])[]) {
    const vars: string[] = [];
    const pattern = S.tpl[k].split(/(\{\w+\})/).map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      if (!m) return escapeRe(p);
      vars.push(m[1]);
      return "(.+?)";
    }).join("");
    const m = new RegExp(`^${pattern}$`).exec(msg);
    if (m) return fmt(to.tpl[k], Object.fromEntries(vars.map((v, i) => [v, localizeImportMessage(m[i + 1], to)])));
  }
  const sep = msg.indexOf(": ");
  if (sep > 0) {
    const field = Object.keys(S.fields).find((k) => S.fields[k] === msg.slice(0, sep));
    if (field) return `${to.fields[field]}: ${localizeImportMessage(msg.slice(sep + 2), to)}`;
  }
  return msg;
}
