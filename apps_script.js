/**
 * Google Apps Script — Léo Ollivier / Setting
 *
 * Fonctions :
 *   1. insertImageFormulas()  → lit l'onglet VISUELS et insère =IMAGE() dans POSTS
 *   2. syncGroupsFromSheet()  → charge la liste des groupes depuis l'onglet GROUPES
 *   3. markPosted()           → marque une ligne comme postée (status + timestamp)
 *
 * Injection via Monaco (Apps Script editor) :
 *   window.monaco.editor.getEditors()[0].getModel().setValue(code)
 */

const SPREADSHEET_ID   = "1py_R-MHNPe31nwn5kDYqNyg1dhbr36C59Li4s10D-7s";
const TAB_VISUELS      = "VISUELS";
const TAB_GROUPES      = "GROUPES";
const TAB_POSTS        = "POSTS";
const DRIVE_FOLDER_ID  = "1OJvZm6DQ3shilxpWCXoA0TmPIfVIBCco";

// ── 1. Insérer les formules =IMAGE() dans l'onglet POSTS ─────────────────────

function insertImageFormulas() {
  const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shVisuels  = ss.getSheetByName(TAB_VISUELS);
  const shPosts    = ss.getSheetByName(TAB_POSTS) || ss.insertSheet(TAB_POSTS);

  const visuelsData = shVisuels.getDataRange().getValues();
  // Colonnes attendues : [Fichier, Drive ID, =IMAGE()]
  // On repart de la colonne Drive ID (index 1)

  const existingIds = {};
  const postsData   = shPosts.getDataRange().getValues();
  postsData.forEach((row, i) => {
    if (i > 0 && row[1]) existingIds[row[1]] = i + 1; // Drive ID → numéro de ligne
  });

  let added = 0;
  visuelsData.forEach((row, i) => {
    if (i === 0) return; // en-tête
    const [fileName, driveId] = row;
    if (!driveId || existingIds[driveId]) return;

    const publicUrl    = `https://drive.google.com/uc?id=${driveId}`;
    const imageFormula = `=IMAGE("${publicUrl}")`;
    const nextRow      = shPosts.getLastRow() + 1;

    shPosts.getRange(nextRow, 1).setValue(fileName);
    shPosts.getRange(nextRow, 2).setValue(driveId);
    shPosts.getRange(nextRow, 3).setFormula(imageFormula);
    shPosts.getRange(nextRow, 4).setValue("pending");
    shPosts.getRange(nextRow, 5).setValue(""); // groupe cible
    shPosts.getRange(nextRow, 6).setValue(""); // date/heure de post

    added++;
  });

  SpreadsheetApp.flush();
  Logger.log(`insertImageFormulas : ${added} ligne(s) ajoutée(s) dans ${TAB_POSTS}.`);
}


// ── 2. Synchroniser les groupes depuis l'onglet GROUPES ──────────────────────

function syncGroupsFromSheet() {
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shGroupes = ss.getSheetByName(TAB_GROUPES);
  if (!shGroupes) {
    Logger.log("Onglet GROUPES introuvable.");
    return [];
  }

  const data   = shGroupes.getDataRange().getValues();
  const groups = [];

  data.forEach((row, i) => {
    if (i === 0) return; // en-tête
    const [name, id, url, category, status] = row;
    if (id && status !== "exclu") {
      groups.push({ name, id: String(id), url, category });
    }
  });

  Logger.log(`syncGroupsFromSheet : ${groups.length} groupes chargés.`);
  return groups;
}


// ── 3. Marquer une ligne comme postée ────────────────────────────────────────

function markPosted(driveId, groupName) {
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh     = ss.getSheetByName(TAB_POSTS);
  const data   = sh.getDataRange().getValues();
  const now    = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === driveId && data[i][3] === "pending") {
      sh.getRange(i + 1, 4).setValue("posted");
      sh.getRange(i + 1, 5).setValue(groupName);
      sh.getRange(i + 1, 6).setValue(now);
      SpreadsheetApp.flush();
      Logger.log(`markPosted : ligne ${i + 1} marquée posted (${groupName}).`);
      return;
    }
  }
  Logger.log(`markPosted : aucune ligne pending trouvée pour driveId=${driveId}.`);
}


// ── 4. Créer les en-têtes si l'onglet POSTS est vide ─────────────────────────

function initPostsSheet() {
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh   = ss.getSheetByName(TAB_POSTS) || ss.insertSheet(TAB_POSTS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Fichier", "Drive ID", "Image", "Statut", "Groupe", "Posté le"]);
    sh.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
}


// ── Point d'entrée principal ─────────────────────────────────────────────────

function main() {
  initPostsSheet();
  insertImageFormulas();
  const groups = syncGroupsFromSheet();
  Logger.log(`Prêt : ${groups.length} groupes disponibles pour le posting.`);
}
