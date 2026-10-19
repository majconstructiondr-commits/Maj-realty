// BORRADORES de documentos legales. Sujetos a revisión de un abogado dominicano antes de publicarse
// como definitivos. No están aprobados jurídicamente. Pueden reemplazarse desde el panel
// (Contenido → bloque "legal.<documento>") sin tocar código.

export type LegalDoc = { title: string; summary: string; sections: { h: string; p: string[] }[] };

const company = "MAJ REALTY SRL";

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacidad: {
    title: "Política de privacidad",
    summary: "Cómo tratamos los datos personales que nos entregas.",
    sections: [
      { h: "Responsable", p: [`${company} es responsable del tratamiento de los datos recogidos en este sitio. Los datos de contacto y el RNC de la empresa se indicarán aquí una vez confirmados.`] },
      { h: "Datos que tratamos", p: ["Datos de contacto (nombre, teléfono, correo), datos de las solicitudes que envías, datos de cuenta, mensajes internos, citas, y documentos que cargues voluntariamente para un servicio (por ejemplo, identificación o documentos del inmueble).", "Datos técnicos mínimos para seguridad y funcionamiento (registros de acceso y eventos de uso como vistas de publicaciones)."] },
      { h: "Finalidades", p: ["Atender tus solicitudes y prestar los servicios contratados; gestionar publicaciones y licencias de publicación; coordinar visitas; preparar cotizaciones; cumplir obligaciones legales aplicables; prevenir fraude y abuso.", "Enviarte información comercial solo si lo autorizas expresamente; puedes retirar esa autorización en cualquier momento."] },
      { h: "Base y marco legal", p: ["El tratamiento se realiza con tu consentimiento, para ejecutar la relación que solicitas o para cumplir obligaciones legales. La Ley No. 172-13 regula la protección de datos de carácter personal en la República Dominicana. La empresa evaluará con profesionales sus procesos y obligaciones aplicables, incluidas las que puedan derivarse de la Ley No. 155-17 para determinados agentes inmobiliarios."] },
      { h: "Con quién compartimos datos", p: ["Con el personal autorizado de MAJ, con el anunciante o asesor asignado cuando consultas por un inmueble, y con proveedores tecnológicos que alojan el servicio (por ejemplo, base de datos y almacenamiento). No vendemos datos personales."] },
      { h: "Conservación", p: ["Conservamos los datos mientras sean necesarios para la finalidad y durante los plazos que exijan las leyes aplicables. Algunos documentos pueden requerir conservación legal y no podrán eliminarse de inmediato; lo evaluaremos caso por caso."] },
      { h: "Tus derechos", p: ["Puedes solicitar acceso, rectificación, actualización o supresión de tus datos, y oponerte a ciertos tratamientos, escribiendo por el canal de reclamaciones. Responderemos dentro de los plazos legales aplicables."] },
      { h: "Seguridad", p: ["Aplicamos controles de acceso por usuario, almacenamiento privado de documentos con enlaces temporales, cifrado en tránsito (HTTPS) y registro de auditoría. Ningún sistema es completamente infalible."] },
    ],
  },
  terminos: {
    title: "Términos de uso",
    summary: "Reglas para usar el sitio y las cuentas.",
    sections: [
      { h: "Uso del sitio", p: ["Puedes navegar, buscar inmuebles y contactarnos sin crear una cuenta. Algunas funciones (chat, agenda, favoritos, publicar) requieren cuenta."] },
      { h: "Información de los inmuebles", p: ["La información de cada publicación la declara el anunciante. Una cuenta aprobada no significa que el inmueble esté jurídicamente verificado. Cuando MAJ realiza una revisión documental, se indica la fecha y el alcance de esa revisión, que no garantiza la ausencia de cargas o gravámenes.", "Los precios se muestran en su moneda original. Las conversiones, cuando aparecen, son orientativas e indican tasa, fuente y fecha."] },
      { h: "Cuentas", p: ["Eres responsable de la confidencialidad de tu contraseña. Podemos suspender cuentas que incumplan estos términos o se usen para fraude."] },
      { h: "Contacto por WhatsApp", p: ["Los botones de WhatsApp abren una conversación en esa aplicación. Abrir el enlace no equivale a un mensaje enviado ni recibido por MAJ."] },
      { h: "Limitación", p: ["El sitio se ofrece tal como está. Las calculadoras y referencias son orientativas y no constituyen asesoría financiera, legal ni aprobación bancaria."] },
    ],
  },
  "condiciones-publicacion": {
    title: "Condiciones de publicación y licencia",
    summary: "Reglas para publicar inmuebles en MAJ.",
    sections: [
      { h: "Qué es la licencia", p: ["La “licencia de publicación” es un permiso contractual interno para publicar en la plataforma de MAJ. No es una licencia profesional ni gubernamental."] },
      { h: "Planes", p: ["Planes Individual, Profesional y Agencia con precio, cuota de publicaciones activas, vigencia y miembros definidos por MAJ. Los pagos se revisan manualmente con comprobante hasta que exista una pasarela configurada."] },
      { h: "Revisión", p: ["Cada publicación se revisa antes de mostrarse. Los cambios materiales (precio, ubicación, documentos y otros datos relevantes) vuelven a revisión y la versión publicada se mantiene hasta su aprobación."] },
      { h: "Vencimiento o suspensión", p: ["Al vencer, suspenderse o cancelarse la licencia, las publicaciones se pausan. Los datos privados y el historial se conservan según la política de privacidad."] },
      { h: "Obligaciones del anunciante", p: ["Publicar solo inmuebles reales con autorización del propietario; mantener la información actualizada; no cargar documentos privados como fotos públicas; no publicar datos de terceros sin autorización."] },
    ],
  },
  "autorizacion-propietario": {
    title: "Autorización del propietario",
    summary: "Modelo de autorización para publicar y representar un inmueble.",
    sections: [
      { h: "Contenido mínimo", p: ["Identificación del propietario o representante, descripción del inmueble, operación (venta o renta), autorización para publicar, si se autoriza o no mostrar la dirección exacta, comisión pactada, exclusividad y su vencimiento, firma y fecha."] },
      { h: "Dirección exacta", p: ["Por defecto solo se publica una ubicación aproximada. La dirección exacta solo se muestra con autorización expresa del propietario."] },
    ],
  },
  "consentimiento-contacto": {
    title: "Consentimiento de contacto",
    summary: "Cuándo y cómo te contactamos.",
    sections: [
      { h: "Contacto para atender tu solicitud", p: ["Al enviar un formulario autorizas que te contactemos por el canal indicado para atender esa solicitud."] },
      { h: "Comunicaciones comerciales", p: ["Solo te enviaremos información de nuevos inmuebles o servicios si marcas la casilla correspondiente. Puedes retirar ese consentimiento en cualquier momento desde tu perfil o escribiéndonos."] },
    ],
  },
  reclamaciones: {
    title: "Canal de reclamaciones",
    summary: "Cómo presentar una queja o ejercer tus derechos sobre tus datos.",
    sections: [
      { h: "Cómo reclamar", p: ["Envía tu reclamación por el formulario de contacto indicando “Reclamación” en el asunto, o por los teléfonos y WhatsApp publicados. Recibirás un número de seguimiento."] },
      { h: "Publicaciones", p: ["Si una publicación contiene información falsa, usa el botón “Reportar esta publicación” en la ficha del inmueble."] },
    ],
  },
  "reglas-verificacion": {
    title: "Reglas de verificación",
    summary: "Qué significan las etiquetas de revisión.",
    sections: [
      { h: "“Identidad revisada”", p: ["Indica que el personal de MAJ revisó un documento de identidad del usuario en la fecha indicada. No acredita la propiedad del inmueble."] },
      { h: "“Documentos revisados el [fecha]”", p: ["Indica que el personal de MAJ revisó los documentos señalados en el alcance de esa fecha. No es una certificación oficial ni garantiza la ausencia de cargas, gravámenes u otros asuntos no incluidos en la revisión. Para conocer el estado jurídico, se recomienda solicitar la certificación correspondiente ante el Registro de Títulos."] },
      { h: "Sin etiqueta", p: ["Si no aparece una etiqueta, MAJ no ha registrado una revisión. Los datos son los declarados por el anunciante."] },
    ],
  },
  cookies: {
    title: "Política de cookies",
    summary: "Qué cookies usa el sitio.",
    sections: [
      { h: "Cookies necesarias", p: ["Usamos cookies técnicas para mantener tu sesión iniciada y proteger los formularios. Son necesarias para el funcionamiento."] },
      { h: "Analítica", p: ["Actualmente no se usan cookies de analítica ni de publicidad de terceros. Si se incorporan, se actualizará esta política y se solicitará el consentimiento que corresponda."] },
      { h: "Mapas", p: ["Los mapas cargan imágenes de OpenStreetMap, que puede registrar datos técnicos de la solicitud según su propia política."] },
    ],
  },
};

// Traducción de referencia al inglés de los mismos borradores (mismas claves y secciones).
// La versión en español es la que rige; las páginas lo indican con un aviso.
export const LEGAL_DOCS_EN: Record<string, LegalDoc> = {
  privacidad: {
    title: "Privacy policy",
    summary: "How we handle the personal data you give us.",
    sections: [
      { h: "Data controller", p: [`${company} is responsible for processing the data collected on this site. The company's contact details and RNC (tax ID) will be listed here once confirmed.`] },
      { h: "Data we process", p: ["Contact details (name, phone, email), details of the requests you send, account data, internal messages, appointments, and documents you voluntarily upload for a service (for example, identification or property documents).", "Minimal technical data for security and operation (access logs and usage events such as listing views)."] },
      { h: "Purposes", p: ["Handling your requests and providing the contracted services; managing listings and publishing licenses; coordinating visits; preparing quotes; complying with applicable legal obligations; preventing fraud and abuse.", "Sending you marketing information only if you expressly authorize it; you can withdraw that authorization at any time."] },
      { h: "Legal basis and framework", p: ["Processing is based on your consent, on carrying out the relationship you request, or on compliance with legal obligations. Law No. 172-13 regulates the protection of personal data in the Dominican Republic. The company will review its processes and applicable obligations with professionals, including those that may arise from Law No. 155-17 for certain real estate agents."] },
      { h: "Who we share data with", p: ["With authorized MAJ staff, with the assigned advertiser or advisor when you ask about a property, and with technology providers that host the service (for example, database and storage). We do not sell personal data."] },
      { h: "Retention", p: ["We keep data for as long as needed for its purpose and for the periods required by applicable law. Some documents may be subject to legal retention and cannot be deleted immediately; we will assess this case by case."] },
      { h: "Your rights", p: ["You can request access to, rectification, updating or deletion of your data, and object to certain processing, by writing through the complaints channel. We will respond within the applicable legal deadlines."] },
      { h: "Security", p: ["We apply per-user access controls, private document storage with temporary links, encryption in transit (HTTPS) and an audit log. No system is completely infallible."] },
    ],
  },
  terminos: {
    title: "Terms of use",
    summary: "Rules for using the site and accounts.",
    sections: [
      { h: "Use of the site", p: ["You can browse, search for properties and contact us without creating an account. Some features (chat, scheduling, favorites, publishing) require an account."] },
      { h: "Property information", p: ["The information in each listing is declared by the advertiser. An approved account does not mean the property has been legally verified. When MAJ carries out a document review, the date and scope of that review are shown; it does not guarantee the absence of liens or encumbrances.", "Prices are shown in their original currency. Conversions, when shown, are approximate and state the rate, source and date."] },
      { h: "Accounts", p: ["You are responsible for keeping your password confidential. We may suspend accounts that breach these terms or are used for fraud."] },
      { h: "WhatsApp contact", p: ["WhatsApp buttons open a conversation in that app. Opening the link is not the same as a message sent to or received by MAJ."] },
      { h: "Limitation", p: ["The site is provided as is. Calculators and references are approximate and do not constitute financial or legal advice or bank approval."] },
    ],
  },
  "condiciones-publicacion": {
    title: "Publishing conditions and license",
    summary: "Rules for listing properties on MAJ.",
    sections: [
      { h: "What the license is", p: ["The “publishing license” is an internal contractual permission to publish on the MAJ platform. It is not a professional or government license."] },
      { h: "Plans", p: ["Individual, Professional and Agency plans with price, active-listing quota, term and members defined by MAJ. Payments are reviewed manually with a receipt until a payment gateway is configured."] },
      { h: "Review", p: ["Every listing is reviewed before it is shown. Material changes (price, location, documents and other relevant data) go back to review, and the published version stays online until they are approved."] },
      { h: "Expiry or suspension", p: ["When the license expires, is suspended or is cancelled, listings are paused. Private data and history are kept according to the privacy policy."] },
      { h: "Advertiser obligations", p: ["Only list real properties with the owner's authorization; keep the information up to date; do not upload private documents as public photos; do not publish third-party data without authorization."] },
    ],
  },
  "autorizacion-propietario": {
    title: "Owner authorization",
    summary: "Template authorization to list and represent a property.",
    sections: [
      { h: "Minimum content", p: ["Identification of the owner or representative, description of the property, transaction (sale or rent), authorization to publish, whether showing the exact address is authorized, agreed commission, exclusivity and its expiry, signature and date."] },
      { h: "Exact address", p: ["By default only an approximate location is published. The exact address is shown only with the owner's express authorization."] },
    ],
  },
  "consentimiento-contacto": {
    title: "Contact consent",
    summary: "When and how we contact you.",
    sections: [
      { h: "Contact to handle your request", p: ["By submitting a form you authorize us to contact you through the channel you indicated in order to handle that request."] },
      { h: "Marketing communications", p: ["We will only send you information about new properties or services if you tick the corresponding box. You can withdraw that consent at any time from your profile or by writing to us."] },
    ],
  },
  reclamaciones: {
    title: "Complaints channel",
    summary: "How to file a complaint or exercise your rights over your data.",
    sections: [
      { h: "How to complain", p: ["Send your complaint through the contact form with “Reclamación” (complaint) in the subject, or through the published phone numbers and WhatsApp. You will receive a tracking number."] },
      { h: "Listings", p: ["If a listing contains false information, use the “Report this listing” button on the property page."] },
    ],
  },
  "reglas-verificacion": {
    title: "Verification rules",
    summary: "What the review labels mean.",
    sections: [
      { h: "“Identity reviewed”", p: ["Means that MAJ staff reviewed an identity document of the user on the date shown. It does not prove ownership of the property."] },
      { h: "“Documents reviewed on [date]”", p: ["Means that MAJ staff reviewed the listed documents within the scope stated for that date. It is not an official certification and does not guarantee the absence of liens, encumbrances or other matters not included in the review. To know the legal status, we recommend requesting the corresponding certification from the Registro de Títulos (Title Registry)."] },
      { h: "No label", p: ["If no label appears, MAJ has not recorded a review. The data is as declared by the advertiser."] },
    ],
  },
  cookies: {
    title: "Cookie policy",
    summary: "Which cookies the site uses.",
    sections: [
      { h: "Necessary cookies", p: ["We use technical cookies to keep you signed in and protect forms. They are necessary for the site to work."] },
      { h: "Analytics", p: ["No third-party analytics or advertising cookies are currently used. If they are added, this policy will be updated and the appropriate consent will be requested."] },
      { h: "Maps", p: ["Maps load images from OpenStreetMap, which may log technical data about the request according to its own policy."] },
    ],
  },
};

/** Documentos en el idioma pedido (en inglés, la traducción de referencia). */
export function legalDocs(locale: "es" | "en"): Record<string, LegalDoc> {
  return locale === "en" ? LEGAL_DOCS_EN : LEGAL_DOCS;
}
