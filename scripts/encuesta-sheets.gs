/**
 * Receptor de la encuesta de VARADO para Google Sheets (Google Apps Script).
 *
 * Instalación:
 *  1. Crea una hoja de cálculo nueva (https://sheets.new).
 *  2. Menú Extensiones → Apps Script. Borra lo que haya y pega este archivo completo. Guarda.
 *  3. Implementar → Nueva implementación → tipo "Aplicación web".
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier usuario
 *     Pulsa Implementar y autoriza el acceso cuando lo pida.
 *  4. Copia la "URL de la aplicación web" (termina en /exec) y pégala en
 *     SURVEY_ENDPOINT, dentro de src/game/config.ts. Vuelve a compilar el juego.
 *
 * Cada evaluación enviada desde el juego se añade como una fila: la primera vez se escriben
 * los encabezados (fecha, datos de la partida y una columna por pregunta).
 * Si cambias este código, vuelve a implementar (Gestionar implementaciones → Editar → Nueva versión).
 */
function doPost(e) {
  var lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    var data = JSON.parse(e.postData.contents)
    if (!Array.isArray(data.headers) || !Array.isArray(data.values) || data.values.length > 200) {
      throw new Error('Formato no válido')
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(data.headers)
      sheet.setFrozenRows(1)
      sheet.getRange(1, 1, 1, data.headers.length).setFontWeight('bold')
    }
    // Las respuestas se guardan como texto plano: nunca como fórmulas.
    var row = data.values.map(function (v) {
      return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v
    })
    sheet.appendRow(row)
    return ContentService.createTextOutput('ok')
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message)
  } finally {
    lock.releaseLock()
  }
}

/** Abrir la URL en el navegador sirve para comprobar que la implementación está activa. */
function doGet() {
  return ContentService.createTextOutput('Receptor de la encuesta de VARADO activo.')
}
