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
