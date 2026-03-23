/**
 * Google Apps Script — Léo Ollivier / Setting
 *
 * Fonctions :
 *   1. insertImageFormulas()     → lit l'onglet VISUELS et insère =IMAGE() dans POSTS
 *   2. syncGroupsFromSheet()     → charge la liste des groupes depuis l'onglet GROUPES
 *   3. markPosted()              → marque une ligne comme postée (status + timestamp)
 *   4. notifySlackOnNewLead(e)   → alerte Slack à chaque nouveau lead dans l'onglet LEADS
 *   5. installLeadsTrigger()     → installe le trigger onChange sur l'onglet LEADS
 *   6. testSlackNotification()   → envoie un message de test Slack
 *
 * Injection via Monaco (Apps Script editor) :
 *   window.monaco.editor.getEditors()[0].getModel().setValue(code)
 *
 * ── SLACK SETUP ──────────────────────────────────────────────────────────────
 * 1. Créer un Incoming Webhook sur https://api.slack.com/apps
 * 2. Coller l'URL dans SLACK_WEBHOOK_URL ci-dessous
 * 3. Lancer installLeadsTrigger() UNE SEULE FOIS pour activer le trigger
 */

const SPREADSHEET_ID   = "1py_R-MHNPe31nwn5kDYqNyg1dhbr36C59Li4s10D-7s";
const TAB_VISUELS      = "VISUELS";
const TAB_GROUPES      = "GROUPES";
const TAB_POSTS        = "POSTS";
const TAB_LEADS        = "LEADS";
const DRIVE_FOLDER_ID  = "1OJvZm6DQ3shilxpWCXoA0TmPIfVIBCco";

// ⬇️ Coller ici l'URL du Webhook Slack (Incoming Webhook)
const SLACK_WEBHOOK_URL = PropertiesService.getScriptProperties()
  .getProperty("SLACK_WEBHOOK_URL") || "";

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


// ════════════════════════════════════════════════════════════════════════════
// ── 5. SLACK — Notification automatique à chaque nouveau lead ───────────────
// ════════════════════════════════════════════════════════════════════════════

/**
 * Colonnes attendues dans l'onglet LEADS (ligne 1 = en-têtes) :
 *   A  Nom          — Prénom Nom du commentateur
 *   B  Profil URL   — Lien Facebook du profil
 *   C  Groupe       — Nom ou ID du groupe
 *   D  Commentaire  — Texte du commentaire (trigger)
 *   E  Détecté le   — Date/heure ISO
 *   F  Semaine      — ex. 2025-W12
 *   G  Statut       — nouveau / traité / relancé
 */

/**
 * Trigger principal — appelé automatiquement par Google Apps Script
 * à chaque modification du spreadsheet.
 * Installe ce trigger avec installLeadsTrigger() ci-dessous.
 *
 * @param {GoogleAppsScript.Events.SheetsOnChange} e
 */
function notifySlackOnNewLead(e) {
  if (!SLACK_WEBHOOK_URL) {
    Logger.log("SLACK_WEBHOOK_URL non configurée. Lance setSlackWebhook('https://hooks.slack.com/…') d'abord.");
    return;
  }

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const shLeads  = ss.getSheetByName(TAB_LEADS);
  if (!shLeads) return;

  // On ne réagit qu'aux insertions de ligne (ROW_INSERTED) ou modifications
  // sur l'onglet LEADS. Pour les edits directs on vérifie via onEdit.
  const lastRow = shLeads.getLastRow();
  if (lastRow < 2) return;   // Seulement l'en-tête → rien à faire

  // Lire la dernière ligne ajoutée
  const row  = shLeads.getRange(lastRow, 1, 1, 7).getValues()[0];
  const [nom, profilUrl, groupe, commentaire, detecteLe, semaine, statut] = row;

  // Ignorer si la ligne est vide ou déjà notifiée
  if (!nom && !profilUrl) return;
  if (statut === "notifié") return;

  // Construire le message Slack (Block Kit)
  const profileLink = profilUrl
    ? `<${profilUrl}|${nom || "Voir le profil"}>`
    : (nom || "Inconnu");

  const date = detecteLe
    ? String(detecteLe).substring(0, 16).replace("T", " à ")
    : new Date().toLocaleString("fr-FR");

  const payload = {
    text: `🎯 Nouveau lead : ${nom || "Inconnu"} (${groupe || "?"})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🎯 Nouveau lead qualifié !" }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Profil :*\n${profileLink}` },
          { type: "mrkdwn", text: `*Groupe :*\n${groupe || "—"}` }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Commentaire :*\n_${String(commentaire || "").substring(0, 150)}_`
        }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Détecté le ${date} · Semaine ${semaine || "?"}` }]
      },
      { type: "divider" }
    ]
  };

  try {
    const options = {
      method:      "post",
      contentType: "application/json",
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true,
    };
    const resp = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
    Logger.log(`[Slack] Statut : ${resp.getResponseCode()} — lead: ${nom}`);

    // Marquer la ligne comme notifiée pour éviter les doublons
    shLeads.getRange(lastRow, 7).setValue("notifié");
    SpreadsheetApp.flush();
  } catch (err) {
    Logger.log(`[Slack] Erreur : ${err}`);
  }
}


// ── Trigger onEdit (modifications manuelles dans l'onglet LEADS) ─────────────

/**
 * Déclenché à chaque édition manuelle d'une cellule.
 * Si une nouvelle ligne est complétée dans LEADS, envoie la notif Slack.
 */
function onEditLeads(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== TAB_LEADS) return;

  const row = e.range.getRow();
  if (row < 2) return;   // Ignorer l'en-tête

  // On notifie seulement si la colonne A (Nom) vient d'être remplie
  const nom = sheet.getRange(row, 1).getValue();
  if (!nom) return;

  // Vérifier que ce n'est pas déjà notifié (colonne G)
  const statut = sheet.getRange(row, 7).getValue();
  if (statut === "notifié") return;

  // Simuler l'appel de notifySlackOnNewLead en passant la bonne feuille active
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  sheet.setActiveRange(sheet.getRange(row, 1));
  notifySlackOnNewLead(e);
}


// ── Helpers de configuration ──────────────────────────────────────────────────

/**
 * Installe le trigger onChange ET onEdit sur ce spreadsheet.
 * À exécuter UNE SEULE FOIS depuis l'éditeur Apps Script.
 */
function installLeadsTrigger() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les anciens triggers pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(t => {
    if (
      t.getHandlerFunction() === "notifySlackOnNewLead" ||
      t.getHandlerFunction() === "onEditLeads"
    ) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Trigger onChange (insertion de lignes par l'API / import)
  ScriptApp.newTrigger("notifySlackOnNewLead")
    .forSpreadsheet(ss)
    .onChange()
    .create();

  // Trigger onEdit (saisie manuelle)
  ScriptApp.newTrigger("onEditLeads")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("✅ Triggers leads installés (onChange + onEdit → Slack).");
}

/**
 * Enregistre l'URL du Webhook Slack dans les propriétés du script.
 * Appelle cette fonction une fois : setSlackWebhook("https://hooks.slack.com/…")
 *
 * @param {string} webhookUrl
 */
function setSlackWebhook(webhookUrl) {
  PropertiesService.getScriptProperties().setProperty("SLACK_WEBHOOK_URL", webhookUrl);
  Logger.log("✅ SLACK_WEBHOOK_URL enregistrée.");
}

/**
 * Envoie un message de test Slack pour vérifier la configuration.
 */
function testSlackNotification() {
  if (!SLACK_WEBHOOK_URL) {
    Logger.log("❌ SLACK_WEBHOOK_URL non configurée. Lance setSlackWebhook('https://hooks.slack.com/…')");
    return;
  }
  const payload = {
    text: "✅ *Setting Agent — Slack connecté !*\nTu recevras ici une alerte pour chaque nouveau lead dans le Google Sheet LEADS.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: (
            "*✅ Setting Agent — Slack connecté !*\n\n" +
            "Tu recevras ici une alerte à chaque nouveau lead ajouté dans l'onglet *LEADS* du Google Sheet.\n\n" +
            "• 🎯 Nom + lien profil Facebook\n" +
            "• 👥 Groupe source\n" +
            "• 💬 Commentaire déclencheur\n" +
            "• 🕐 Date de détection"
          )
        }
      }
    ]
  };
  const resp = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method:      "post",
    contentType: "application/json",
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log(`[Slack Test] Réponse : ${resp.getResponseCode()} — ${resp.getContentText()}`);
}


// ── Initialisation de l'onglet LEADS ─────────────────────────────────────────

/**
 * Crée l'onglet LEADS avec ses en-têtes s'il n'existe pas encore.
 */
function initLeadsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(TAB_LEADS) || ss.insertSheet(TAB_LEADS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Nom", "Profil URL", "Groupe", "Commentaire", "Détecté le", "Semaine", "Statut"]);
    sh.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#4A90D9").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160);  // Nom
    sh.setColumnWidth(2, 240);  // Profil URL
    sh.setColumnWidth(3, 200);  // Groupe
    sh.setColumnWidth(4, 300);  // Commentaire
    sh.setColumnWidth(5, 160);  // Détecté le
    sh.setColumnWidth(6, 100);  // Semaine
    sh.setColumnWidth(7, 90);   // Statut
    Logger.log("✅ Onglet LEADS initialisé.");
  }
}
