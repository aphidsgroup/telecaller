/**
 * Buildogram lead push - Google Apps Script
 * ------------------------------------------------------------------
 * The zero-credential alternative to the Sheets API service account.
 * Paste this into Extensions > Apps Script on the master lead sheet.
 *
 * Setup
 *  1. Script properties (Project Settings > Script properties):
 *       WEBHOOK_URL    = https://your-app.vercel.app/api/webhooks/sheets
 *       WEBHOOK_SECRET = the same value as SHEETS_WEBHOOK_SECRET in .env
 *       SHEET_TAB      = Leads
 *  2. Run `pushNewRows` once and approve the permission prompt.
 *  3. Triggers > Add trigger > pushNewRows > Time-driven > every 5 minutes.
 *     (Optionally also add an On change trigger for near real-time pushes.)
 *
 * The script tracks the last row it sent in script properties, so a run only
 * pushes genuinely new rows. Push the whole sheet again any time with
 * `resendEverything()` - the app de-duplicates by phone number anyway.
 */

var HEADERS = [
  'Name',
  'Phone Number',
  'Alternate Phone',
  'Source',
  'Project/Site of Interest',
  'City/Area',
  'Budget Range',
  'Notes',
  'Date Added',
];

function props_() {
  return PropertiesService.getScriptProperties();
}

function config_() {
  var p = props_();
  var url = p.getProperty('WEBHOOK_URL');
  var secret = p.getProperty('WEBHOOK_SECRET');
  if (!url || !secret) {
    throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Project Settings > Script properties.');
  }
  return { url: url, secret: secret, tab: p.getProperty('SHEET_TAB') || 'Leads' };
}

function pushNewRows() {
  var cfg = config_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(cfg.tab);
  if (!sheet) throw new Error('Sheet tab "' + cfg.tab + '" not found.');

  var lastSent = Number(props_().getProperty('LAST_ROW_SENT') || 1); // row 1 = header
  var lastRow = sheet.getLastRow();
  if (lastRow <= lastSent) {
    Logger.log('Nothing new to send (last row %s, already sent %s).', lastRow, lastSent);
    return;
  }

  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var startRow = lastSent + 1;
  var values = sheet.getRange(startRow, 1, lastRow - lastSent, sheet.getLastColumn()).getValues();

  var rows = [];
  for (var i = 0; i < values.length; i += 1) {
    var row = { rowNumber: startRow + i };
    var blank = true;
    for (var c = 0; c < headerRow.length; c += 1) {
      var key = String(headerRow[c] || '').trim();
      if (!key) continue;
      var cell = values[i][c];
      if (cell instanceof Date) cell = Utilities.formatDate(cell, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
      row[key] = cell === null || cell === undefined ? '' : String(cell).trim();
      if (row[key]) blank = false;
    }
    if (!blank) rows.push(row);
  }

  if (!rows.length) {
    props_().setProperty('LAST_ROW_SENT', String(lastRow));
    return;
  }

  var sent = send_(cfg, rows, ss.getId());
  if (sent) props_().setProperty('LAST_ROW_SENT', String(lastRow));
}

/** Re-sends every data row. Safe: the app flags duplicates, it never doubles up. */
function resendEverything() {
  var cfg = config_();
  props_().setProperty('LAST_ROW_SENT', '1');
  pushNewRows();
}

function send_(cfg, rows, spreadsheetId) {
  var CHUNK = 400;
  var ok = true;
  for (var i = 0; i < rows.length; i += CHUNK) {
    var chunk = rows.slice(i, i + CHUNK);
    var res = UrlFetchApp.fetch(cfg.url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-webhook-secret': cfg.secret },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        spreadsheetId: spreadsheetId,
        sheetTab: cfg.tab,
        rows: chunk,
      }),
    });
    var code = res.getResponseCode();
    Logger.log('Pushed %s rows -> HTTP %s %s', chunk.length, code, res.getContentText());
    if (code < 200 || code >= 300) ok = false;
  }
  return ok;
}

/** Optional: create the expected header row on a fresh sheet. */
function setUpHeaders() {
  var cfg = config_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.tab)
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet(cfg.tab);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
