/** @OnlyCurrentDoc */
/**
 * Perfumista Diário — backend em Google Apps Script, vinculado à planilha "Diário de Uso — Perfumes".
 *
 * Instalação (uma vez): Extensões → Apps Script → colar este arquivo → Salvar → Implantar → Nova implantação →
 * tipo "App da Web", Executar como "Eu", Quem pode acessar "Qualquer pessoa" → Implantar (autorizar) →
 * no editor, escolher a função "configurar" e clicar em Executar → o registro de execução mostra a URL e o
 * token para colar em Ajustes do app.
 *
 * Toda chamada é POST com corpo JSON em text/plain (evita preflight de CORS) e precisa do TOKEN.
 * Ações: ping · metar · dados (Tiers + Diário + Frascos) · registrar (linhas no formato da aba Diário).
 * Regras da planilha: data como texto AAAA-MM-DD; campo vazio = ""; nunca editar ou apagar linhas existentes;
 * aba Frascos é só fórmula (nunca escrita aqui).
 */

var ABA_TIERS = 'Tiers', ABA_DIARIO = 'Diário', ABA_FRASCOS = 'Frascos';
var COLS_DIARIO = ['Data', 'Slot', 'Perfume', 'Ocasião', 'Temp (°C)', 'Td (°C)', 'Sprays', 'NotaDia', 'Obs'];
var OCASIOES = ['Lazer', 'T.Inf', 'T.For', 'N.Inf', 'N.For', 'Cozy D', 'Cozy N'];

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return saida_({ ok: false, erro: 'corpo inválido' }); }
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || req.token !== token) return saida_({ ok: false, erro: 'token inválido' });
  try {
    switch (req.acao) {
      case 'ping': return saida_({ ok: true, planilha: SpreadsheetApp.getActive().getName() });
      case 'metar': return saida_({ ok: true, metar: metar_() });
      case 'dados': return saida_({ ok: true, dados: dados_() });
      case 'registrar': return saida_(registrar_(req.linhas || [], !!req.forcar));
      default: return saida_({ ok: false, erro: 'ação desconhecida' });
    }
  } catch (err) {
    return saida_({ ok: false, erro: String(err && err.message || err) });
  }
}

/** Rode uma vez no editor (Executar ▶ configurar): cria o TOKEN se não existir e mostra URL + token. */
function configurar() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token) {
    token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('TOKEN', token);
  }
  var url = ScriptApp.getService().getUrl();
  Logger.log('URL do App da Web: ' + (url || '(implante primeiro: Implantar → Nova implantação → App da Web)'));
  Logger.log('Token: ' + token);
  return { url: url, token: token };
}

function doGet() { return saida_({ ok: false, erro: 'use POST' }); }

function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── METAR SBSP (Congonhas) ─────────────────────────
function metar_() {
  var r = UrlFetchApp.fetch('https://aviationweather.gov/api/data/metar?ids=SBSP&format=json', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('aviationweather.gov respondeu ' + r.getResponseCode());
  var j = JSON.parse(r.getContentText());
  if (!j.length) throw new Error('METAR SBSP vazio');
  var m = j[0];
  if (m.dewp === null || m.dewp === undefined) throw new Error('METAR sem ponto de orvalho');
  return { T: m.temp, Td: m.dewp, obs: new Date(m.obsTime * 1000).toISOString(), raw: m.rawOb };
}

// ───────────────────────── leitura ─────────────────────────
function valores_(nome) {
  var aba = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!aba) throw new Error('aba "' + nome + '" não encontrada');
  return aba.getDataRange().getDisplayValues();
}

function dados_() {
  var t = valores_(ABA_TIERS), d = valores_(ABA_DIARIO), f = [];
  try { f = valores_(ABA_FRASCOS); } catch (err) { f = []; }
  return { tiers: t, diario: d, frascos: f, lido: new Date().toISOString() };
}

// ───────────────────────── gravação ─────────────────────────
/** Valida uma linha do diário vinda do app; devolve a linha normalizada (array de 9 textos) ou lança erro. */
function normalizarLinha_(l, nomesValidos) {
  var data = String(l.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('data inválida: ' + data);
  var slot = String(l.slot || '');
  if (slot !== 'M' && slot !== 'N') throw new Error('slot inválido: ' + slot);
  var perfume = String(l.perfume || '').trim();
  if (!perfume) throw new Error('perfume vazio');
  if (nomesValidos && nomesValidos.indexOf(perfume) === -1) throw new Error('"' + perfume + '" não está na aba Tiers (Nome no diário ou Perfume)');
  var oc = String(l.ocasiao || '');
  if (oc && OCASIOES.indexOf(oc) === -1) throw new Error('ocasião inválida: ' + oc);
  var txt = function (v) { return v === null || v === undefined ? '' : String(v); };
  return [data, slot, perfume, oc, txt(l.temp), txt(l.td), txt(l.sprays), txt(l.notaDia), txt(l.obs)];
}

/** Linha (1-based) depois da qual inserir para manter a ordem cronológica (data, depois M antes de N). */
function posicaoInsercao_(existentes, data, slot) {
  // existentes: [[data, slot], ...] a partir da linha 2
  var chave = data + (slot === 'M' ? '0' : '1');
  for (var i = existentes.length - 1; i >= 0; i--) {
    var e = existentes[i], k = String(e[0]) + (e[1] === 'N' ? '1' : '0');
    if (k <= chave) return i + 2; // linha da planilha (cabeçalho = 1)
  }
  return 1;
}

function registrar_(linhas, forcar) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var aba = ss.getSheetByName(ABA_DIARIO);
    var tiers = valores_(ABA_TIERS);
    var iNome = tiers[0].indexOf('Nome no diário'), iPerf = tiers[0].indexOf('Perfume');
    var nomes = [];
    tiers.slice(1).forEach(function (r) { if (r[iNome]) nomes.push(r[iNome]); if (r[iPerf]) nomes.push(r[iPerf]); });
    var gravadas = [], conflitos = [];
    for (var k = 0; k < linhas.length; k++) {
      var linha = normalizarLinha_(linhas[k], nomes);
      var ult = aba.getLastRow();
      var exist = ult > 1 ? aba.getRange(2, 1, ult - 1, 3).getDisplayValues() : [];
      var mesmo = exist.filter(function (r) { return r[0] === linha[0] && r[1] === linha[1]; });
      if (mesmo.some(function (r) { return r[2] === linha[2]; }) && !forcar) {
        gravadas.push({ id: linhas[k].id, duplicada: true }); continue;   // reenvio da fila: já está lá
      }
      if (mesmo.length && !forcar) { conflitos.push({ id: linhas[k].id, existente: mesmo[0][2] }); continue; }
      var depois = posicaoInsercao_(exist, linha[0], linha[1]);
      var alvo;
      if (depois >= aba.getLastRow()) { alvo = aba.getLastRow() + 1; }
      else { aba.insertRowAfter(depois); alvo = depois + 1; }
      aba.getRange(alvo, 1).setNumberFormat('@');   // data como texto AAAA-MM-DD (não vira data do Sheets)
      aba.getRange(alvo, 1, 1, COLS_DIARIO.length).setValues([linha]);
      gravadas.push({ id: linhas[k].id, linha: alvo });
    }
    SpreadsheetApp.flush();
    return { ok: true, gravadas: gravadas, conflitos: conflitos };
  } finally {
    lock.releaseLock();
  }
}
