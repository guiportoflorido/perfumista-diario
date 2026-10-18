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
 * Ações: ping · metar · dados (Tiers + Diário + Frascos) · registrar (linhas no formato da aba Diário; slots M, M2, E, N, N2) ·
 *        editarRegistro · removerRegistro (só registros dos últimos DIAS_EDITAVEIS dias da aba Diário) ·
 *        mercado (lê a aba Mercado) · criarMercado (cria a aba uma vez) · editarMercado (edita um perfume,
 *        inclusive casa/nome; tier e posse também vão para a aba Tiers) · adicionarMercado · removerMercado
 *        (tira só da aba Mercado; Tiers e Diário não mudam) · amostras (lê a aba Amostras) · adicionarAmostra (cria a
 *        aba no primeiro registro) · editarAmostra · removerAmostra (por ID; avaliação — tier, arquétipo etc. — fica
 *        na aba Mercado, ligada pela Casa + Perfume) · subirFoto (guarda a foto na aba Fotos desta planilha — nada de
 *        Google Drive — e marca a coluna Foto da aba Mercado) · fotos (devolve as fotos pedidas) · removerFoto.
 * Regras da planilha: data como texto AAAA-MM-DD; campo vazio = ""; linhas existentes do Diário só mudam por
 *   editarRegistro/removerRegistro (pedido explícito do usuário no app, só registros recentes);
 * aba Frascos é só fórmula (nunca escrita aqui).
 */

var ABA_TIERS = 'Tiers', ABA_DIARIO = 'Diário', ABA_FRASCOS = 'Frascos', ABA_MERCADO = 'Mercado';
var COLS_MERCADO = ['Casa', 'Perfume', 'Tier', 'Posse', 'Arquétipo', 'Resumo', 'Topo', 'Coração', 'Base', 'Nariz', 'Wishlist', 'Atualizado em'];
var EDITAVEIS = ['Tier', 'Posse', 'Arquétipo', 'Resumo', 'Topo', 'Coração', 'Base', 'Nariz', 'Wishlist', 'Notas'];   // Foto: só por subirFoto/removerFoto
var ABA_FOTOS = 'Fotos', COLS_FOTOS = ['Casa', 'Perfume', 'Versão', 'Tipo'];
var PARTES_FOTO = 10, TAM_PARTE = 45000;   // célula aceita até 50 mil caracteres: a imagem (base64) vai em pedaços
var COLS_DIARIO = ['Data', 'Slot', 'Perfume', 'Ocasião', 'Temp (°C)', 'Td (°C)', 'Sprays', 'NotaDia', 'Obs'];
var ABA_AMOSTRAS = 'Amostras';
var COLS_AMOSTRAS = ['ID', 'Casa', 'Perfume', 'Tipo', 'Volume (ml)', 'Origem', 'Status', 'Entrada', 'Saída', 'Motivo saída', 'Impressão', 'Obs', 'Atualizado em', 'Dono'];
var DONOS_AMOSTRA = ['', 'Gui', 'Bia'], TIPOS_AMOSTRA = ['Amostra', 'Decant'], STATUS_AMOSTRA = ['Pendente', 'Em teste', 'Realizado', 'Esgotado'];
var DIAS_EDITAVEIS = 30;   // editar/apagar no Diário: só registros com data a partir de hoje − 30 dias
// Slot: M (Dia) · M2 (2ª aplicação do Dia) · E (Esportes) · N (Noite) · N2 (2ª aplicação da Noite) — nesta ordem no dia
var SLOTS = ['M', 'M2', 'E', 'N', 'N2'];
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
      case 'editarRegistro': return saida_(editarRegistro_(req.orig || {}, req.campos || {}, Number(req.linha) || 0));
      case 'removerRegistro': return saida_(removerRegistro_(req.orig || {}, Number(req.linha) || 0));
      case 'mercado': return saida_({ ok: true, mercado: lerMercado_() });
      case 'criarMercado': return saida_(criarMercado_(req.linhas || []));
      case 'editarMercado': return saida_(editarMercado_(req.casa, req.perfume, req.campos || {}));
      case 'adicionarMercado': return saida_(adicionarMercado_(req.campos || {}));
      case 'removerMercado': return saida_(removerMercado_(req.casa, req.perfume));
      case 'amostras': return saida_({ ok: true, amostras: lerAmostras_() });
      case 'adicionarAmostra': return saida_(adicionarAmostra_(req.campos || {}));
      case 'editarAmostra': return saida_(editarAmostra_(req.id, req.campos || {}));
      case 'removerAmostra': return saida_(removerAmostra_(req.id));
      case 'subirFoto': return saida_(subirFoto_(req.casa, req.perfume, req.imagem, req.tipo));
      case 'fotos': return saida_({ ok: true, fotos: lerFotos_(req.itens || []) });
      case 'removerFoto': return saida_(removerFoto_(req.casa, req.perfume));
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
  if (SLOTS.indexOf(slot) === -1) throw new Error('slot inválido: ' + slot + ' (use M, M2, E, N ou N2)');
  var perfume = String(l.perfume || '').trim();
  if (!perfume) throw new Error('perfume vazio');
  if (nomesValidos && nomesValidos.indexOf(perfume) === -1) throw new Error('"' + perfume + '" não está na aba Tiers (Nome no diário ou Perfume)');
  var oc = String(l.ocasiao || '');
  if (oc && OCASIOES.indexOf(oc) === -1) throw new Error('ocasião inválida: ' + oc);
  var txt = function (v) { return v === null || v === undefined ? '' : String(v); };
  return [data, slot, perfume, oc, txt(l.temp), txt(l.td), txt(l.sprays), txt(l.notaDia), txt(l.obs)];
}

/** Linha (1-based) depois da qual inserir para manter a ordem cronológica (data, depois a ordem de SLOTS). */
function posicaoInsercao_(existentes, data, slot) {
  // existentes: [[data, slot], ...] a partir da linha 2
  var ordem = function (s) { return Math.max(0, SLOTS.indexOf(String(s))); };
  var chave = data + ordem(slot);
  for (var i = existentes.length - 1; i >= 0; i--) {
    var e = existentes[i], k = String(e[0]) + ordem(e[1]);
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
      gravadas.push({ id: linhas[k].id, linha: inserirDiario_(aba, exist, linha) });
    }
    SpreadsheetApp.flush();
    return { ok: true, gravadas: gravadas, conflitos: conflitos };
  } finally {
    lock.releaseLock();
  }
}

/** Insere a linha na posição cronológica (data, depois M antes de N). exist = colunas A:C a partir da linha 2. */
function inserirDiario_(aba, exist, linha) {
  var depois = posicaoInsercao_(exist, linha[0], linha[1]), alvo;
  if (depois >= aba.getLastRow()) { alvo = aba.getLastRow() + 1; }
  else { aba.insertRowAfter(depois); alvo = depois + 1; }
  aba.getRange(alvo, 1).setNumberFormat('@');   // data como texto AAAA-MM-DD (não vira data do Sheets)
  aba.getRange(alvo, 1, 1, COLS_DIARIO.length).setValues([linha]);
  return alvo;
}

// ─────────────── editar / apagar registros recentes do Diário ───────────────
// O app manda o registro como ele o conhece (data, slot, perfume) e a linha que ele viu. A linha só é usada se ainda
// tiver exatamente esse conteúdo; senão procura pelo conteúdo. Duas linhas iguais = recusa (resolver na planilha).
function limiteEditavel_() { return Utilities.formatDate(new Date(Date.now() - DIAS_EDITAVEIS * 864e5), 'America/Sao_Paulo', 'yyyy-MM-dd'); }

function acharRegistro_(exist, orig, dica) {
  var bate = function (r) { return r[0] === String(orig.data) && r[1] === String(orig.slot) && r[2] === String(orig.perfume); };
  if (dica >= 2 && dica - 2 < exist.length && bate(exist[dica - 2])) return dica;
  var achados = [];
  exist.forEach(function (r, i) { if (bate(r)) achados.push(i + 2); });
  if (achados.length > 1) throw new Error('há ' + achados.length + ' linhas iguais (' + orig.data + ' ' + orig.slot + ' ' + orig.perfume + ') na aba Diário: corrija direto na planilha');
  if (!achados.length) throw new Error('registro não encontrado na aba Diário (' + orig.data + ' ' + orig.slot + ' ' + orig.perfume + '): talvez já tenha sido mudado; sincronize e tente de novo');
  return achados[0];
}

function editarRegistro_(orig, campos, dica) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive(), aba = ss.getSheetByName(ABA_DIARIO), limite = limiteEditavel_();
    if (String(orig.data) < limite) throw new Error('só dá para editar registros a partir de ' + limite + ' (últimos ' + DIAS_EDITAVEIS + ' dias)');
    var ult = aba.getLastRow(), exist = ult > 1 ? aba.getRange(2, 1, ult - 1, 3).getDisplayValues() : [];
    var linha = acharRegistro_(exist, orig, dica);
    var atual = aba.getRange(linha, 1, 1, COLS_DIARIO.length).getDisplayValues()[0];
    var chaves = ['data', 'slot', 'perfume', 'ocasiao', 'temp', 'td', 'sprays', 'notaDia', 'obs'], l = {};
    chaves.forEach(function (k, i) { l[k] = campos[k] !== undefined ? campos[k] : atual[i]; });
    var tiers = valores_(ABA_TIERS), iNome = tiers[0].indexOf('Nome no diário'), iPerf = tiers[0].indexOf('Perfume'), nomes = [];
    tiers.slice(1).forEach(function (r) { if (r[iNome]) nomes.push(r[iNome]); if (r[iPerf]) nomes.push(r[iPerf]); });
    var nova = normalizarLinha_(l, nomes);
    if (nova[0] < limite || nova[0] > hoje_()) throw new Error('data fora do período editável (' + limite + ' a ' + hoje_() + ')');
    var mudouSlot = nova[0] !== atual[0] || nova[1] !== atual[1];
    if (mudouSlot) {
      var ocup = exist.filter(function (r, i) { return i + 2 !== linha && r[0] === nova[0] && r[1] === nova[1]; });
      if (ocup.length) throw new Error('nesse dia e slot já existe ' + ocup[0][2] + ': apague ou edite aquele registro primeiro');
      aba.deleteRow(linha);
      exist.splice(linha - 2, 1);
      linha = inserirDiario_(aba, exist, nova);
    } else {
      aba.getRange(linha, 1).setNumberFormat('@');
      aba.getRange(linha, 1, 1, COLS_DIARIO.length).setValues([nova]);
    }
    SpreadsheetApp.flush();
    return { ok: true, linha: linha, registro: nova };
  } finally { lock.releaseLock(); }
}

function removerRegistro_(orig, dica) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_DIARIO), limite = limiteEditavel_();
    if (String(orig.data) < limite) throw new Error('só dá para apagar registros a partir de ' + limite + ' (últimos ' + DIAS_EDITAVEIS + ' dias)');
    var ult = aba.getLastRow(), exist = ult > 1 ? aba.getRange(2, 1, ult - 1, 3).getDisplayValues() : [];
    var linha = acharRegistro_(exist, orig, dica);
    aba.deleteRow(linha);
    SpreadsheetApp.flush();
    return { ok: true, removida: linha };
  } finally { lock.releaseLock(); }
}

// ───────────────────────── mercado ─────────────────────────
function chave_(casa, perfume) {
  return (String(casa) + '|' + String(perfume)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function hoje_() { return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'); }

function lerMercado_() {
  var aba = SpreadsheetApp.getActive().getSheetByName(ABA_MERCADO);
  if (!aba) return { existe: false };
  return { existe: true, linhas: aba.getDataRange().getDisplayValues(), lido: new Date().toISOString() };
}

/** Cria a aba Mercado com as linhas enviadas pelo app (base da avaliação + tier/posse da aba Tiers). Só uma vez. */
function criarMercado_(linhas) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    if (ss.getSheetByName(ABA_MERCADO)) return { ok: false, erro: 'a aba Mercado já existe' };
    if (!linhas.length) return { ok: false, erro: 'nenhuma linha enviada' };
    var vals = linhas.map(function (l) {
      if (l.length !== COLS_MERCADO.length) throw new Error('linha com ' + l.length + ' colunas');
      return l.map(function (v) { return v === null || v === undefined ? '' : String(v); });
    });
    var aba = ss.insertSheet(ABA_MERCADO);
    aba.getRange(1, 1, 1, COLS_MERCADO.length).setValues([COLS_MERCADO]).setFontWeight('bold');
    var rg = aba.getRange(2, 1, vals.length, COLS_MERCADO.length);
    rg.setNumberFormat('@');                 // tudo texto: nada de autoformatação de datas ou números
    rg.setValues(vals);
    aba.setFrozenRows(1);
    SpreadsheetApp.flush();
    return { ok: true, linhas: vals.length };
  } finally { lock.releaseLock(); }
}

/** Edita um perfume da aba Mercado. Tier e Posse também são gravados na aba Tiers (fonte única de tier). */
function editarMercado_(casa, perfume, campos) {
  if (!casa || !perfume) throw new Error('casa e perfume são obrigatórios');
  if (campos.Tier !== undefined && ['', 'S', 'A', 'B', 'C', 'D'].indexOf(String(campos.Tier)) === -1) throw new Error('tier inválido: ' + campos.Tier);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var aba = ss.getSheetByName(ABA_MERCADO);
    if (!aba) throw new Error('a aba Mercado ainda não existe');
    if (campos.Notas !== undefined) garantirColuna_(aba, 'Notas');
    var vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
    var linha = acharLinha_(vals, casa, perfume);
    if (linha === -1) throw new Error('perfume não encontrado na aba Mercado: ' + casa + ' — ' + perfume);
    var mudou = [];
    // renomear (Casa/Perfume): a chave nova não pode já existir
    var novaCasa = campos.Casa !== undefined ? String(campos.Casa).trim() : casa;
    var novoNome = campos.Perfume !== undefined ? String(campos.Perfume).trim() : perfume;
    var renomeou = chave_(novaCasa, novoNome) !== chave_(casa, perfume);
    if (renomeou) {
      if (!novaCasa || !novoNome) throw new Error('casa e perfume não podem ficar vazios');
      if (acharLinha_(vals, novaCasa, novoNome) !== -1) throw new Error('já existe ' + novaCasa + ' — ' + novoNome + ' na aba Mercado');
      aba.getRange(linha, 1, 1, 2).setNumberFormat('@').setValues([[novaCasa, novoNome]]);
      moverFoto_(casa, perfume, novaCasa, novoNome);
      mudou.push('Casa/Perfume');
    }
    EDITAVEIS.forEach(function (c) {
      if (campos[c] === undefined) return;
      var col = cab.indexOf(c) + 1;
      if (col < 1) return;
      aba.getRange(linha, col).setNumberFormat('@').setValue(String(campos[c]));
      mudou.push(c);
    });
    aba.getRange(linha, cab.indexOf('Atualizado em') + 1).setNumberFormat('@').setValue(hoje_());
    var tiers = null;
    if (renomeou) tiers = renomearTiers_(ss, casa, perfume, novaCasa, novoNome);
    if (campos.Tier !== undefined || campos.Posse !== undefined) tiers = gravarTiers_(ss, novaCasa, novoNome, campos);
    SpreadsheetApp.flush();
    return { ok: true, linha: linha, mudou: mudou, tiers: tiers };
  } finally { lock.releaseLock(); }
}

function gravarTiers_(ss, casa, perfume, campos) {
  var aba = ss.getSheetByName(ABA_TIERS), vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
  var iCasa = cab.indexOf('Casa'), iPerf = cab.indexOf('Perfume'), iPosse = cab.indexOf('Posse'), iTier = cab.indexOf('Tier'), iAt = cab.indexOf('Atualizado em');
  var k = chave_(casa, perfume);
  for (var i = 1; i < vals.length; i++) {
    if (chave_(vals[i][iCasa], vals[i][iPerf]) !== k) continue;
    if (campos.Posse !== undefined) aba.getRange(i + 1, iPosse + 1).setValue(String(campos.Posse));
    if (campos.Tier !== undefined) aba.getRange(i + 1, iTier + 1).setValue(String(campos.Tier));
    if (iAt >= 0) aba.getRange(i + 1, iAt + 1).setNumberFormat('@').setValue(hoje_());
    return { linha: i + 1, nova: false };
  }
  var nova = cab.map(function () { return ''; });
  nova[iCasa] = casa; nova[iPerf] = perfume;
  nova[iPosse] = campos.Posse !== undefined ? String(campos.Posse) : '';
  nova[iTier] = campos.Tier !== undefined ? String(campos.Tier) : '';
  if (iAt >= 0) nova[iAt] = hoje_();
  aba.appendRow(nova);
  return { linha: aba.getLastRow(), nova: true };
}

function acharLinha_(vals, casa, perfume) {
  var k = chave_(casa, perfume);
  for (var i = 1; i < vals.length; i++) if (chave_(vals[i][0], vals[i][1]) === k) return i + 1;
  return -1;
}

function garantirColuna_(aba, nome) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn ? aba.getLastColumn() : 30).getDisplayValues()[0];
  if (cab.indexOf(nome) !== -1) return;
  var col = cab.filter(String).length + 1;
  aba.getRange(1, col).setValue(nome).setFontWeight('bold');
}

/** Renomeia Casa/Perfume na aba Tiers (o "Nome no diário" não muda: é o elo com o Diário). */
function renomearTiers_(ss, casa, perfume, novaCasa, novoNome) {
  var aba = ss.getSheetByName(ABA_TIERS), vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
  var iCasa = cab.indexOf('Casa'), iPerf = cab.indexOf('Perfume'), k = chave_(casa, perfume);
  for (var i = 1; i < vals.length; i++) {
    if (chave_(vals[i][iCasa], vals[i][iPerf]) !== k) continue;
    aba.getRange(i + 1, iCasa + 1).setValue(novaCasa);
    aba.getRange(i + 1, iPerf + 1).setValue(novoNome);
    return { linha: i + 1, renomeado: true };
  }
  return null;
}

/** Acrescenta um perfume à aba Mercado (Casa e Perfume obrigatórios; sem duplicar). Tier/Posse vão também para Tiers. */
function adicionarMercado_(campos) {
  var casa = String(campos.Casa || '').trim(), perfume = String(campos.Perfume || '').trim();
  if (!casa || !perfume) throw new Error('casa e perfume são obrigatórios');
  if (campos.Tier !== undefined && ['', 'S', 'A', 'B', 'C', 'D'].indexOf(String(campos.Tier)) === -1) throw new Error('tier inválido: ' + campos.Tier);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive(), aba = ss.getSheetByName(ABA_MERCADO);
    if (!aba) throw new Error('a aba Mercado ainda não existe');
    if (campos.Notas) garantirColuna_(aba, 'Notas');
    var vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
    if (acharLinha_(vals, casa, perfume) !== -1) throw new Error('já existe ' + casa + ' — ' + perfume + ' na aba Mercado');
    var nova = cab.map(function (c) {
      if (c === 'Casa') return casa;
      if (c === 'Perfume') return perfume;
      if (c === 'Atualizado em') return hoje_();
      return campos[c] === undefined || campos[c] === null ? '' : String(campos[c]);
    });
    var alvo = aba.getLastRow() + 1;
    aba.getRange(alvo, 1, 1, cab.length).setNumberFormat('@').setValues([nova]);
    var tiers = (campos.Tier || campos.Posse) ? gravarTiers_(ss, casa, perfume, campos) : null;
    SpreadsheetApp.flush();
    return { ok: true, linha: alvo, tiers: tiers };
  } finally { lock.releaseLock(); }
}

/** Remove um perfume da aba Mercado. Não mexe na aba Tiers nem no Diário. */
function removerMercado_(casa, perfume) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_MERCADO);
    if (!aba) throw new Error('a aba Mercado ainda não existe');
    var linha = acharLinha_(aba.getDataRange().getDisplayValues(), casa, perfume);
    if (linha === -1) throw new Error('perfume não encontrado na aba Mercado: ' + casa + ' — ' + perfume);
    aba.deleteRow(linha);
    moverFoto_(casa, perfume, null, null);
    SpreadsheetApp.flush();
    return { ok: true, removida: linha };
  } finally { lock.releaseLock(); }
}

// ───────────────────────── amostras e decants ─────────────────────────
// Uma linha por amostra/decant (o mesmo perfume pode ter várias). A avaliação (tier, arquétipo, resumo, wishlist)
// não é copiada aqui: vive na aba Mercado e o app liga as duas pela Casa + Perfume.
function lerAmostras_() {
  var aba = SpreadsheetApp.getActive().getSheetByName(ABA_AMOSTRAS);
  if (!aba) return { existe: false };
  return { existe: true, linhas: aba.getDataRange().getDisplayValues(), lido: new Date().toISOString() };
}

/** Valida os campos enviados (só os presentes; em `completo`, Casa e Perfume são obrigatórios). */
function validarAmostra_(c, completo) {
  var txt = function (k) { return c[k] === undefined || c[k] === null ? undefined : String(c[k]).trim(); };
  if (completo && (!txt('Casa') || !txt('Perfume'))) throw new Error('casa e perfume são obrigatórios');
  if (!completo && (c.Casa !== undefined && !txt('Casa') || c.Perfume !== undefined && !txt('Perfume'))) throw new Error('casa e perfume não podem ficar vazios');
  if (txt('Tipo') !== undefined && TIPOS_AMOSTRA.indexOf(txt('Tipo')) === -1) throw new Error('tipo inválido: ' + c.Tipo);
  if (txt('Dono') !== undefined && DONOS_AMOSTRA.indexOf(txt('Dono')) === -1) throw new Error('dono inválido: ' + c.Dono);
  if (txt('Status') !== undefined && STATUS_AMOSTRA.indexOf(txt('Status')) === -1) throw new Error('status inválido: ' + c.Status);
  ['Entrada', 'Saída'].forEach(function (k) {
    var v = txt(k);
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(k.toLowerCase() + ' inválida: ' + v + ' (use AAAA-MM-DD)');
  });
  var ml = txt('Volume (ml)');
  if (ml && !/^\d+([.,]\d+)?$/.test(ml)) throw new Error('volume inválido: ' + ml);
  var ent = txt('Entrada'), sai = txt('Saída');
  if (ent && sai && sai < ent) throw new Error('saída antes da entrada');
}

function abaAmostras_(ss) {
  var aba = ss.getSheetByName(ABA_AMOSTRAS);
  if (aba) return aba;
  aba = ss.insertSheet(ABA_AMOSTRAS);
  aba.getRange(1, 1, 1, COLS_AMOSTRAS.length).setValues([COLS_AMOSTRAS]).setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

function acharAmostra_(vals, id) {
  var i = vals[0].indexOf('ID');
  for (var r = 1; r < vals.length; r++) if (String(vals[r][i]) === String(id)) return r + 1;
  return -1;
}

/** Acrescenta uma amostra (ID vem do app, para o reenvio não duplicar). Cria a aba Amostras se faltar. */
function adicionarAmostra_(campos) {
  validarAmostra_(campos, true);
  var id = String(campos.ID || '').trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) throw new Error('ID inválido');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = abaAmostras_(SpreadsheetApp.getActive());
    if (campos.Dono) garantirColuna_(aba, 'Dono');   // aba criada antes da coluna Dono
    var vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
    var ja = acharAmostra_(vals, id);
    if (ja !== -1) return { ok: true, linha: ja, duplicada: true };
    var nova = cab.map(function (c) {
      if (c === 'Atualizado em') return hoje_();
      if (c === 'Tipo' && !campos.Tipo) return 'Amostra';
      if (c === 'Status' && !campos.Status) return 'Pendente';
      return campos[c] === undefined || campos[c] === null ? '' : String(campos[c]).trim();
    });
    var alvo = aba.getLastRow() + 1;
    aba.getRange(alvo, 1, 1, cab.length).setNumberFormat('@').setValues([nova]);
    SpreadsheetApp.flush();
    return { ok: true, linha: alvo };
  } finally { lock.releaseLock(); }
}

/** Edita uma amostra pelo ID (qualquer coluna menos ID e Atualizado em). */
function editarAmostra_(id, campos) {
  if (!id) throw new Error('ID obrigatório');
  validarAmostra_(campos, false);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_AMOSTRAS);
    if (!aba) throw new Error('a aba Amostras ainda não existe');
    if (campos.Dono !== undefined) garantirColuna_(aba, 'Dono');
    var vals = aba.getDataRange().getDisplayValues(), cab = vals[0];
    var linha = acharAmostra_(vals, id);
    if (linha === -1) throw new Error('amostra não encontrada: ' + id);
    var atual = {}; cab.forEach(function (c, j) { atual[c] = vals[linha - 1][j]; });
    var ent = campos.Entrada !== undefined ? String(campos.Entrada) : atual.Entrada, sai = campos['Saída'] !== undefined ? String(campos['Saída']) : atual['Saída'];
    if (ent && sai && sai < ent) throw new Error('saída antes da entrada');
    var mudou = [];
    cab.forEach(function (c, j) {
      if (c === 'ID' || c === 'Atualizado em' || campos[c] === undefined) return;
      aba.getRange(linha, j + 1).setNumberFormat('@').setValue(String(campos[c]).trim());
      mudou.push(c);
    });
    aba.getRange(linha, cab.indexOf('Atualizado em') + 1).setNumberFormat('@').setValue(hoje_());
    SpreadsheetApp.flush();
    return { ok: true, linha: linha, mudou: mudou };
  } finally { lock.releaseLock(); }
}

/** Apaga a linha de uma amostra (para lançamento errado; saída normal é Status Esgotado + data de saída). */
function removerAmostra_(id) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_AMOSTRAS);
    if (!aba) throw new Error('a aba Amostras ainda não existe');
    var linha = acharAmostra_(aba.getDataRange().getDisplayValues(), id);
    if (linha === -1) throw new Error('amostra não encontrada: ' + id);
    aba.deleteRow(linha);
    SpreadsheetApp.flush();
    return { ok: true, removida: linha };
  } finally { lock.releaseLock(); }
}

// ───────────────────────── fotos ─────────────────────────
// A foto (JPEG já reduzido pelo app) fica na aba Fotos desta planilha, em base64 dividido em pedaços, uma linha por
// perfume (Casa + Perfume). Não usa o Google Drive: a única permissão é a desta planilha. Na aba Mercado, a coluna
// Foto recebe só uma marca com data e hora (a "versão"), para o app saber que há foto e quando ela mudou.
function abaFotos_(criar) {
  var ss = SpreadsheetApp.getActive(), aba = ss.getSheetByName(ABA_FOTOS);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(ABA_FOTOS);
  var cab = COLS_FOTOS.slice();
  for (var i = 1; i <= PARTES_FOTO; i++) cab.push('Imagem ' + i);
  aba.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
  aba.setFrozenRows(1);
  aba.hideSheet();
  return aba;
}

/** Linha (1-based) da foto de casa+perfume na aba Fotos, ou -1. Lê só Casa e Perfume (as imagens são pesadas). */
function linhaFoto_(aba, casa, perfume) {
  var n = aba.getLastRow();
  if (n < 2) return -1;
  var vals = aba.getRange(1, 1, n, 2).getDisplayValues(), k = chave_(casa, perfume);
  for (var i = 1; i < vals.length; i++) if (chave_(vals[i][0], vals[i][1]) === k) return i + 1;
  return -1;
}

function subirFoto_(casa, perfume, imagem, tipo) {
  if (!casa || !perfume) throw new Error('casa e perfume são obrigatórios');
  tipo = String(tipo || 'image/jpeg');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(tipo) === -1) throw new Error('tipo de imagem não aceito: ' + tipo);
  imagem = String(imagem || '');
  if (!imagem || !/^[A-Za-z0-9+\/=]+$/.test(imagem)) throw new Error('imagem vazia ou inválida');
  if (imagem.length > PARTES_FOTO * TAM_PARTE) throw new Error('imagem grande demais');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_MERCADO);
    if (!aba) throw new Error('a aba Mercado ainda não existe');
    var vals = aba.getDataRange().getDisplayValues(), linha = acharLinha_(vals, casa, perfume);
    if (linha === -1) throw new Error('perfume não encontrado na aba Mercado: ' + casa + ' — ' + perfume);
    casa = vals[linha - 1][0]; perfume = vals[linha - 1][1];
    var versao = 'aba Fotos · ' + new Date().toISOString();
    var partes = [];
    for (var i = 0; i < PARTES_FOTO; i++) partes.push(imagem.slice(i * TAM_PARTE, (i + 1) * TAM_PARTE));
    var fotos = abaFotos_(true), lf = linhaFoto_(fotos, casa, perfume);
    if (lf === -1) lf = fotos.getLastRow() + 1;
    fotos.getRange(lf, 1, 1, COLS_FOTOS.length + PARTES_FOTO).setNumberFormat('@').setValues([[casa, perfume, versao, tipo].concat(partes)]);
    garantirColuna_(aba, 'Foto');
    var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    aba.getRange(linha, cab.indexOf('Foto') + 1).setNumberFormat('@').setValue(versao);
    aba.getRange(linha, cab.indexOf('Atualizado em') + 1).setNumberFormat('@').setValue(hoje_());
    SpreadsheetApp.flush();
    return { ok: true, versao: versao, linha: linha };
  } finally { lock.releaseLock(); }
}

/** itens = [{casa, perfume}] (até 12 por chamada) → [{casa, perfume, versao, tipo, imagem}] das que existem. */
function lerFotos_(itens) {
  var aba = abaFotos_(false), saida = [];
  if (!aba) return saida;
  itens.slice(0, 12).forEach(function (it) {
    var lf = linhaFoto_(aba, it.casa, it.perfume);
    if (lf === -1) return;
    var l = aba.getRange(lf, 1, 1, COLS_FOTOS.length + PARTES_FOTO).getDisplayValues()[0];
    saida.push({ casa: it.casa, perfume: it.perfume, versao: l[2], tipo: l[3], imagem: l.slice(COLS_FOTOS.length).join('') });
  });
  return saida;
}

/** Apaga a foto (linha da aba Fotos) e limpa a coluna Foto da aba Mercado. */
function removerFoto_(casa, perfume) {
  if (!casa || !perfume) throw new Error('casa e perfume são obrigatórios');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var fotos = abaFotos_(false), lf = fotos ? linhaFoto_(fotos, casa, perfume) : -1;
    if (lf !== -1) fotos.deleteRow(lf);
    var aba = SpreadsheetApp.getActive().getSheetByName(ABA_MERCADO);
    if (aba) {
      var vals = aba.getDataRange().getDisplayValues(), linha = acharLinha_(vals, casa, perfume), col = vals[0].indexOf('Foto');
      if (linha !== -1 && col !== -1) aba.getRange(linha, col + 1).setNumberFormat('@').setValue('');
    }
    SpreadsheetApp.flush();
    return { ok: true, apagada: lf !== -1 };
  } finally { lock.releaseLock(); }
}

/** Quando o perfume muda de casa/nome ou sai da aba Mercado, a foto acompanha (ou é apagada). */
function moverFoto_(casa, perfume, novaCasa, novoNome) {
  var fotos = abaFotos_(false), lf = fotos ? linhaFoto_(fotos, casa, perfume) : -1;
  if (lf === -1) return;
  if (novaCasa === null) fotos.deleteRow(lf);
  else fotos.getRange(lf, 1, 1, 2).setNumberFormat('@').setValues([[novaCasa, novoNome]]);
}
