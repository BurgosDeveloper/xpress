import { Router } from "express";

const APP_NAME = "STAR TRASLADOS C.A";
const EFFECTIVE_DATE = "23 de abril de 2026";
const CHILD_SAFETY_EFFECTIVE_DATE = "27 de abril de 2026";
const SUPPORT_EMAIL = "burgosdeveloper@gmail.com";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage(params: {
  title: string;
  intro?: string;
  effectiveDate?: string;
  sections: Array<{ title: string; paragraphs?: string[]; items?: string[] }>;
}) {
  const intro = params.intro ? `<p>${escapeHtml(params.intro)}</p>` : "";
  const sections = params.sections
    .map((section) => {
      const paragraphs = (section.paragraphs ?? []).map((text) => `<p>${escapeHtml(text)}</p>`).join("");
      const items = (section.items ?? []).length
        ? `<ul>${(section.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";

      return `<section><h2>${escapeHtml(section.title)}</h2>${paragraphs}${items}</section>`;
    })
    .join("");

  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(params.title)} | ${escapeHtml(APP_NAME)}</title>`,
    "</head>",
    "<body>",
    `  <main>`,
    `    <h1>${escapeHtml(params.title)}</h1>`,
    `    <p><strong>Aplicación:</strong> ${escapeHtml(APP_NAME)}</p>`,
    `    <p><strong>Fecha de vigencia:</strong> ${escapeHtml(params.effectiveDate ?? EFFECTIVE_DATE)}</p>`,
    `    ${intro}`,
    `    ${sections}`,
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function renderPrivacyPolicyHtml() {
  return renderPage({
    title: "Política de privacidad",
    intro:
      "Esta política describe qué datos puede tratar la aplicación, con qué finalidad, cómo se protegen y qué opciones tienen los usuarios sobre su información.",
    sections: [
      {
        title: "1. Datos que podemos tratar",
        items: [
          "Datos de cuenta y contacto: nombre completo, correo electrónico, teléfono, nombre de usuario y contraseña.",
          "Datos de perfil: nombres, apellidos, foto de perfil y demás información que el usuario decida completar en su perfil.",
          "Datos de conductor: teléfono, foto, tipo de servicio, datos del vehículo, fotos del vehículo y datos de pago móvil cuando correspondan.",
          "Datos de viaje: ubicación de origen y destino, direcciones, coordenadas, ruta estimada, distancia, duración, estado del servicio y preferencias del viaje.",
          "Datos de ubicación precisa: la aplicación usa ubicación en primer plano para buscar, calcular y gestionar servicios; en el caso de conductores, también puede usar ubicación en segundo plano mientras estén disponibles o prestando el servicio.",
          "Datos de notificaciones: tokens de notificación push y eventos necesarios para avisos operativos del servicio.",
          "Datos de interacción: calificaciones, comentarios y registros operativos mínimos necesarios para soporte, seguridad y funcionamiento de la app.",
        ],
      },
      {
        title: "2. Finalidades del tratamiento",
        items: [
          "Crear y administrar cuentas de usuarios, pasajeros y conductores.",
          "Permitir la solicitud, asignación, seguimiento y finalización de traslados.",
          "Mostrar conductores o solicitudes cercanas según la ubicación del usuario.",
          "Enviar notificaciones relacionadas con viajes, ofertas, cambios de estado, seguridad y operación del servicio.",
          "Permitir la gestión del perfil, recuperación de contraseña y atención de soporte.",
          "Mantener la seguridad de la plataforma, prevenir fraude y resolver incidencias operativas o reclamos.",
        ],
      },
      {
        title: "3. Compartición de datos",
        paragraphs: [
          "La app no vende datos personales. Solo comparte información cuando es necesario para prestar el servicio, cumplir obligaciones legales o apoyarse en proveedores tecnológicos que operan la plataforma.",
        ],
        items: [
          "Entre pasajeros y conductores, únicamente los datos necesarios para coordinar un traslado.",
          "Con proveedores de infraestructura, alojamiento, almacenamiento de archivos, mapas, rutas y notificaciones push, en la medida necesaria para operar la app.",
          "Con autoridades o terceros cuando exista una obligación legal, una orden válida o una necesidad legítima de defensa de derechos.",
        ],
      },
      {
        title: "4. Conservación de la información",
        paragraphs: [
          "Los datos se conservan mientras la cuenta permanezca activa o mientras sean necesarios para prestar el servicio, resolver disputas, atender soporte, prevenir fraude o cumplir obligaciones legales, fiscales o regulatorias.",
          "Cuando un usuario solicita la eliminación de su cuenta, se elimina la cuenta y los datos asociados, salvo la información que deba conservarse temporalmente por motivos legales, de seguridad o prevención de fraude.",
        ],
      },
      {
        title: "5. Seguridad",
        items: [
          "La app utiliza conexiones cifradas en tránsito hacia los servicios de backend cuando se encuentra en operación normal.",
          "La contraseña del usuario se almacena de forma protegida en el servidor y no se expone en texto plano desde la API.",
          "Pueden existir datos operativos almacenados de forma segura en el dispositivo para facilitar el uso de la app, como credenciales locales o estados temporales de viaje.",
        ],
      },
      {
        title: "6. Derechos del usuario",
        items: [
          "Acceder y actualizar sus datos desde la app cuando la funcionalidad esté disponible.",
          "Solicitar la eliminación de su cuenta y de los datos asociados desde la app o mediante el recurso web de eliminación de cuenta.",
          "Contactar al correo de soporte publicado en la ficha de Google Play para consultas relacionadas con privacidad o eliminación de datos.",
        ],
      },
      {
        title: "7. Menores de edad",
        paragraphs: [
          "La app no está dirigida a niños y no debe ser utilizada por menores de edad sin la autorización y supervisión correspondiente de su representante legal, de acuerdo con la normativa aplicable.",
        ],
      },
      {
        title: "8. Cambios a esta política",
        paragraphs: [
          "Esta política puede actualizarse para reflejar cambios legales, operativos o funcionales. La versión vigente será la publicada en esta misma URL.",
        ],
      },
      {
        title: "9. Contacto",
        paragraphs: [
          "Para consultas sobre privacidad, seguridad de datos o eliminación de cuenta, usa el correo de soporte publicado en la ficha de Google Play de la aplicación.",
        ],
      },
    ],
  });
}

function renderAccountDeletionHtml() {
  return renderPage({
    title: "Eliminación de cuenta",
    intro:
      "Los usuarios de STAR TRASLADOS C.A pueden solicitar la eliminación de su cuenta y de los datos asociados conforme a los requisitos de Google Play.",
    sections: [
      {
        title: "1. Solicitud desde la app",
        items: [
          "Inicia sesión en la app.",
          "Abre la pantalla Perfil.",
          "Pulsa Eliminar cuenta.",
          "Confirma la acción para eliminar tu cuenta y cerrar tu sesión en el dispositivo.",
        ],
      },
      {
        title: "2. Solicitud mediante recurso web",
        paragraphs: [
          "Si no puedes acceder a la app, puedes solicitar la eliminación escribiendo al correo de soporte publicado en la ficha de Google Play de la aplicación.",
          "En tu mensaje indica, como mínimo, el correo electrónico y el número de teléfono asociados a la cuenta para poder ubicarla y procesar la solicitud.",
        ],
      },
      {
        title: "3. Qué se elimina",
        items: [
          "Cuenta del usuario y perfil asociado.",
          "Tokens de notificaciones push asociados a la cuenta.",
          "Datos del perfil del pasajero o del conductor y, cuando corresponda, vehículo, ubicación y archivos vinculados al perfil.",
          "Datos operativos asociados que puedan eliminarse automáticamente conforme al modelo de la plataforma.",
        ],
      },
      {
        title: "4. Datos que podrían conservarse temporalmente",
        items: [
          "Información que deba retenerse por obligaciones legales, fiscales, regulatorias o de prevención de fraude.",
          "Registros mínimos necesarios para resolver disputas, auditorías o incidentes de seguridad.",
        ],
      },
      {
        title: "5. Tiempo de procesamiento",
        paragraphs: [
          "Las solicitudes se procesan en un plazo razonable y pueden requerir validación básica de identidad para proteger la cuenta del usuario.",
        ],
      },
    ],
  });
}

function renderChildSafetyStandardsHtml() {
  return renderPage({
    title: "Estándares de seguridad de los niños",
    effectiveDate: CHILD_SAFETY_EFFECTIVE_DATE,
    intro:
      "STAR TRASLADOS C.A mantiene una política de tolerancia cero frente a cualquier forma de explotación, abuso sexual infantil o material de abuso sexual infantil (CSAM/CSAE) dentro de la plataforma.",
    sections: [
      {
        title: "1. Conducta prohibida",
        items: [
          "Está prohibido publicar, compartir, solicitar, promocionar o almacenar material relacionado con abuso o explotación sexual infantil.",
          "Está prohibido usar la app para contactar, captar, acosar, amenazar o explotar a menores de edad.",
          "Está prohibido cualquier intento de grooming, sextorsión, trata, coerción o facilitación de encuentros ilegales con menores.",
          "Está prohibido el uso de cuentas, perfiles, mensajes, archivos o datos de viaje para fines que vulneren la integridad y seguridad de niños, niñas o adolescentes.",
        ],
      },
      {
        title: "2. Alcance y elegibilidad",
        paragraphs: [
          "La aplicación no está dirigida a niños. El uso de la plataforma debe realizarse conforme a la normativa aplicable y bajo la responsabilidad de adultos autorizados cuando corresponda.",
        ],
      },
      {
        title: "3. Medidas de prevención y respuesta",
        items: [
          "Se pueden suspender o eliminar de inmediato cuentas involucradas en conductas prohibidas o sospechas razonables de este tipo de abuso.",
          "Se pueden bloquear contenidos, archivos, perfiles o accesos relacionados con reportes de seguridad infantil.",
          "La plataforma puede conservar registros mínimos necesarios para investigación, auditoría, prevención de fraude y cooperación con autoridades competentes.",
          "Cuando corresponda, se colaborará con autoridades y requerimientos legales válidos para la protección de menores.",
        ],
      },
      {
        title: "4. Cómo reportar",
        paragraphs: [
          `Si detectas una conducta, contenido o interacción que pueda poner en riesgo a un menor, repórtalo de inmediato al correo ${SUPPORT_EMAIL}.`,
          "Incluye, si los tienes, datos como usuario involucrado, teléfono, capturas, fecha, hora y cualquier referencia del viaje o incidente para facilitar la revisión.",
          "Si existe riesgo inminente o posible delito, además del reporte en la plataforma, contacta de inmediato a las autoridades competentes de tu jurisdicción.",
        ],
      },
      {
        title: "5. Cumplimiento",
        paragraphs: [
          "El incumplimiento de estos estándares puede derivar en suspensión permanente de la cuenta, bloqueo de acceso, preservación de evidencias y demás acciones permitidas por la ley y por las políticas de la plataforma.",
        ],
      },
      {
        title: "6. Contacto designado",
        paragraphs: [
          `Correo de contacto para este estándar: ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  });
}

export const legalRouter = Router();

legalRouter.get("/privacy-policy", (_req, res) => {
  res.status(200).type("html").send(renderPrivacyPolicyHtml());
});

legalRouter.get("/account-deletion", (_req, res) => {
  res.status(200).type("html").send(renderAccountDeletionHtml());
});

legalRouter.get("/child-safety-standards", (_req, res) => {
  res.status(200).type("html").send(renderChildSafetyStandardsHtml());
});