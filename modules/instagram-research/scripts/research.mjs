#!/usr/bin/env node
// Instagram research: the commands the member's AI and other apps run.
//   node .flyee/modules/instagram-research/scripts/research.mjs <command> [options] [--json]
// The full interface is in references/interface.md.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { apifyAccess, apifyApi, canCollect, chargeCeiling, estimateUsd, keySetup, runActor } from "./lib/apify.mjs";
import { actorFailure, normalizeComment, normalizePost, parsePost, parseProfile } from "./lib/instagram.mjs";
import { apifyFileToPosts, readingToPosts } from "./lib/reading.mjs";
import { commentsMarkdown, outliersMarkdown, postsCsv, profileMarkdown } from "./lib/report.mjs";
import { durationBuckets, measureProfile, rank, RANKS } from "./lib/score.mjs";
import { AppError, ageHours, choiceOption, intOption, isoDay, parseArgs, projectRoot, readJson, slugify, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "instagram-research", version: MANIFEST.version ?? "0.0.0" };
const SOURCES = readJson(join(APP_DIR, "references", "fontes.json"), {});
const INTERFACE_VERSION = 1;
const RESEARCH_DIR = join(ROOT, "instagram-research");
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "research.mjs"))}`;
/** How long a collection stays fresh, in hours. */
const FRESH = { profile: 24, comments: 7 * 24 };
const SOURCE_CHOICES = ["auto", "apify", "reading"];
const ARG_SPEC = {
  flags: ["json", "refresh", "confirm-cost"],
  options: ["posts", "name", "rank", "max", "source", "apify-url"],
};

const rel = (path) => toPosix(ROOT, path);
const usage = (message, fix = "Rode o comando `help` para ver as opções.") => new AppError("usage", message, fix);
const profileDir = (user) => join(RESEARCH_DIR, "profiles", user);
const postDir = (shortcode) => join(RESEARCH_DIR, "posts", shortcode);
const today = () => isoDay();
const usd = (value) => `US$ ${value.toFixed(2).replace(".", ",")}`;

function errorOf(error) {
  const known = error instanceof AppError;
  return {
    code: known ? error.code : "unexpected",
    message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
    fix: known ? error.fix : "Tente de novo; se repetir, rode o comando check e guarde esta mensagem.",
  };
}

/** What the AI tells the member and runs when there is no key: the key, or a reading by hand. */
function manualStep(users) {
  return {
    say: "Sem a chave do Apify, este perfil não é colhido sozinho. Há dois caminhos: o integrante salva a chave, ou traz capturas de tela que você lê.",
    key: keySetup(),
    reading: {
      how: `Peça ao integrante uma captura da aba de Reels de ${users.map((user) => `@${user}`).join(", ")}, com os números de visualização à mostra. Leia cada miniatura, na ordem da tela, e grave o texto como aparece em instagram-research/leituras/<perfil>.json, no formato de leitura de references/interface.md. Depois rode import com esse arquivo.`,
      template: { version: 1, kind: "reels_grid", profile: `@${users[0] ?? "perfil"}`, collected_at: today(), source: { type: "screenshot", ref: "capturas/perfil-reels.png" }, items: [{ plays_text: "12,3 mil", pinned: false }] },
    },
  };
}

// ---------------------------------------------------------------- profiles

/** Writes the files of one measured profile and returns the result other apps read. */
function saveProfile(user, posts, source, { rankBy = "index", warnings: extra = [], cached = false, cost = null } = {}) {
  const measured = measureProfile(posts, { rankBy });
  const dir = profileDir(user);
  const warnings = [...extra];
  const reels = measured.baseline.reels;
  if (reels.status === "indication") warnings.push(`Só ${reels.n} Reels com plays: o normal deste perfil é indício, não medida.`);
  if (reels.status === "none" && measured.sample.reels > 0) warnings.push(`Menos de 3 Reels com plays (${reels.n}): sem normal, os multiplicadores dos Reels ficam vazios.`);
  if (typeof reels.value === "number" && reels.value < 200) warnings.push(`O normal deste perfil é baixo (${reels.value} plays): poucos plays já viram multiplicador alto. Cite sempre os plays ao lado.`);
  const hidden = posts.filter((post) => post.hidden_likes).length;
  if (hidden) warnings.push(`${hidden} post(s) com curtidas ocultas: o engajamento deles fica vazio.`);
  const result = {
    ok: true,
    command: "profile",
    interface_version: INTERFACE_VERSION,
    app: APP,
    id: user,
    source,
    cached,
    baseline: measured.baseline,
    sample: measured.sample,
    durations: measured.durations,
    reels: measured.reels,
    static: measured.static,
    files: { json: rel(join(dir, "profile.json")), md: rel(join(dir, "profile.md")), csv: rel(join(dir, "profile.csv")) },
    cost,
    warnings,
  };
  writeJson(join(dir, "profile.json"), result);
  writeFileAtomic(join(dir, "profile.md"), profileMarkdown(result));
  writeFileAtomic(join(dir, "profile.csv"), postsCsv([...result.reels, ...result.static]));
  return result;
}

/** The stdout view of a profile: the files hold everything, the answer the top of each list. */
function profileView(result) {
  const { reels, static: statics, ...rest } = result;
  return { ...rest, top_reels: reels.slice(0, 10), top_static: statics.slice(0, 5) };
}

function freshRaw(user, posts) {
  const path = join(profileDir(user), "raw.json");
  const raw = readJson(path);
  if (!raw?.items || ageHours(path) >= FRESH.profile || (raw.posts_requested ?? 0) < posts) return null;
  return raw;
}

function savedReading(user) {
  const data = readJson(join(profileDir(user), "profile.json"));
  return data && data.source?.type !== "apify" ? data : null;
}

/**
 * Brings the posts of each profile: a fresh collection kept in the project, then a new collection
 * with the key, then a reading the member brought. Returns what it got and what is missing.
 */
async function gatherProfiles(users, values) {
  const posts = intOption(values, "posts", 30, 5, 100);
  const source = choiceOption(values, "source", "auto", SOURCE_CHOICES);
  const refresh = Boolean(values.refresh);
  const got = new Map();
  const warnings = [];
  const toFetch = [];
  const missing = [];
  const access = await apifyAccess({ api: apifyApi(values["apify-url"]) });
  for (const user of users) {
    const reading = savedReading(user);
    if (source === "reading") {
      if (reading) got.set(user, { kind: "reading", data: reading });
      else missing.push(user);
      continue;
    }
    // What the project already has comes first: a fresh collection, then a reading the member brought.
    // A new paid collection only when there is nothing, or when asked for (--refresh, --source apify).
    const raw = refresh ? null : freshRaw(user, posts);
    if (raw) got.set(user, { kind: "raw", raw, cached: true });
    else if (source === "auto" && reading && !refresh) got.set(user, { kind: "reading", data: reading });
    else toFetch.push(user);
  }
  let cost = null;
  if (toFetch.length) {
    if (!canCollect(access)) {
      for (const user of toFetch) {
        const reading = source === "apify" ? null : savedReading(user);
        if (reading) got.set(user, { kind: "reading", data: reading });
        else missing.push(user);
      }
    } else {
      const source = SOURCES.posts;
      const estimate = estimateUsd(source, toFetch.length * posts);
      if (estimate > (SOURCES.cost_warn_usd ?? 1) && !values["confirm-cost"]) {
        throw new AppError(
          "needs_confirmation",
          `Colher ${posts} posts de ${toFetch.length} perfil(is) deve custar até ${usd(estimate)} no Apify, acima do limite de ${usd(SOURCES.cost_warn_usd ?? 1)} que o app pede para confirmar.`,
          "Diga o valor ao integrante. Com o sim, repita o comando com --confirm-cost; ou peça menos perfis ou menos posts.",
        );
      }
      const collected = await runActor({
        actor: source.actor,
        input: { username: toFetch, resultsLimit: posts, skipPinnedPosts: true },
        token: access.key,
        maxItems: toFetch.length * posts,
        maxChargeUsd: chargeCeiling(estimate),
        api: apifyApi(values["apify-url"]),
        label: `${toFetch.length} perfil(is)`,
      });
      cost = { estimate_usd: estimate, charged_usd: collected.run.usage_usd, run_id: collected.run.id };
      const byUser = new Map(toFetch.map((user) => [user, []]));
      for (const item of collected.items) {
        const owner = String(item.ownerUsername ?? item.username ?? "").toLowerCase();
        if (byUser.has(owner)) byUser.get(owner).push(item);
      }
      for (const [user, items] of byUser) {
        const failure = actorFailure(items);
        if (failure || !items.length) {
          const reading = savedReading(user);
          if (reading) got.set(user, { kind: "reading", data: reading });
          else missing.push(user);
          warnings.push(failure?.code === "not_found" ? `@${user} não existe no Instagram.` : failure ? `@${user} não pôde ser lido (${failure.code}${failure.description ? `: ${failure.description}` : ""}).` : `@${user} não trouxe nenhum post: o perfil pode ser privado ou não ter posts.`);
          continue;
        }
        const raw = { collected_at: today(), posts_requested: posts, actor: source.actor, run_id: collected.run.id, items: items.filter((item) => !item.error) };
        writeJson(join(profileDir(user), "raw.json"), raw);
        if (raw.items.length < posts) warnings.push(`@${user}: pedi ${posts} posts e vieram ${raw.items.length}.`);
        got.set(user, { kind: "raw", raw, cached: false });
      }
    }
  }
  return { got, missing, warnings, cost };
}

function measuredFrom(user, entry, values, extra = {}) {
  const rankBy = choiceOption(values, "rank", "index", RANKS);
  if (entry.kind === "reading") {
    const posts = [...entry.data.reels, ...entry.data.static].map(({ metric, multiplier, band, engagement, index, flags, ...post }) => post);
    return saveProfile(user, posts, entry.data.source, { rankBy, cached: true, ...extra });
  }
  const posts = entry.raw.items.map((item) => normalizePost(item, { collectedAt: entry.raw.collected_at }));
  const source = { type: "apify", actor: entry.raw.actor, collected_at: entry.raw.collected_at, ref: `https://www.instagram.com/${user}/` };
  return saveProfile(user, posts, source, { rankBy, cached: entry.cached, ...extra });
}

async function profileCommand(positionals, values) {
  if (positionals.length !== 1) throw usage("Informe um perfil: profile <@perfil>.", "Para comparar vários perfis, use outliers.");
  const user = parseProfile(positionals[0]);
  const { got, missing, warnings, cost } = await gatherProfiles([user], values);
  if (!got.has(user)) {
    if (warnings.length) throw new AppError("profile_not_found", warnings[0], "Confira o @ com o integrante.");
    return { ok: true, command: "profile", interface_version: INTERFACE_VERSION, app: APP, id: user, mode: "manual", collected: false, missing, next_step: manualStep([user]) };
  }
  return profileView(measuredFrom(user, got.get(user), values, { warnings, cost }));
}

async function outliersCommand(positionals, values) {
  if (positionals.length < 2) throw usage("Informe de 2 a 25 perfis: outliers <@perfil> <@perfil>…", "Para um perfil só, use profile.");
  if (positionals.length > 25) throw usage("No máximo 25 perfis por pesquisa.");
  const users = [...new Set(positionals.map(parseProfile))];
  const { got, missing, warnings, cost } = await gatherProfiles(users, values);
  if (!got.size) {
    return { ok: true, command: "outliers", interface_version: INTERFACE_VERSION, app: APP, mode: "manual", collected: false, missing, next_step: manualStep(missing), warnings };
  }
  const rankBy = choiceOption(values, "rank", "index", RANKS);
  const profiles = [...got].map(([user, entry]) => measuredFrom(user, entry, values));
  const reels = rank(profiles.flatMap((profile) => profile.reels.map((reel) => ({ ...reel, profile: profile.id }))), rankBy);
  const statics = rank(profiles.flatMap((profile) => profile.static.map((post) => ({ ...post, profile: profile.id }))), rankBy);
  const name = slugify(values.name ?? `${users[0]}-e-${users.length - 1}-${today()}`, 60) || `pesquisa-${today()}`;
  const dir = join(RESEARCH_DIR, "outliers", name);
  if (missing.length) warnings.push(`Ficaram de fora: ${missing.map((user) => `@${user}`).join(", ")}.`);
  const indications = profiles.filter((profile) => profile.baseline.reels.status !== "measured").map((profile) => `@${profile.id}`);
  if (indications.length) warnings.push(`Normal só indicativo ou ausente em ${indications.join(", ")}: os Reels desses perfis contam como indício.`);
  const result = {
    ok: true,
    command: "outliers",
    interface_version: INTERFACE_VERSION,
    app: APP,
    id: name,
    created_at: new Date().toISOString(),
    profiles: profiles.map((profile) => ({ id: profile.id, source: profile.source, baseline: profile.baseline, sample: profile.sample, files: profile.files })),
    sample: { profiles: profiles.length, reels: reels.length, static: statics.length },
    durations: durationBuckets(reels),
    reels,
    static: statics,
    missing,
    cost,
    files: { json: rel(join(dir, "outliers.json")), md: rel(join(dir, "outliers.md")), csv: rel(join(dir, "outliers.csv")) },
    warnings,
  };
  writeJson(join(dir, "outliers.json"), result);
  writeFileAtomic(join(dir, "outliers.md"), outliersMarkdown(result));
  writeFileAtomic(join(dir, "outliers.csv"), postsCsv([...reels, ...statics]));
  const { reels: all, static: allStatic, ...view } = result;
  return { ...view, top_reels: all.slice(0, 15), top_static: allStatic.slice(0, 5) };
}

// ---------------------------------------------------------------- import

function importCommand(positionals, values) {
  if (positionals.length !== 1) throw usage("Informe o arquivo: import <arquivo .json>.");
  const file = resolve(ROOT, positionals[0]);
  if (!existsSync(file)) throw new AppError("not_found", `Não encontrei ${positionals[0]}.`, "Passe o caminho a partir da raiz do projeto.");
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    throw new AppError("reading_invalid", `${positionals[0]} não é um JSON válido.`, "Use o formato de leitura de references/interface.md.");
  }
  const rankBy = choiceOption(values, "rank", "index", RANKS);
  if (Array.isArray(data)) {
    // The collector's items carry no collection date: the day the file was saved is the closest one.
    const collectedAt = isoDay(statSync(file).mtime);
    const { profiles, posts, source } = apifyFileToPosts(data, { collectedAt, ref: rel(file) });
    if (!posts.length) throw new AppError("reading_invalid", "O arquivo não tem posts.", "Confira se é a saída do coletor de posts do Instagram.");
    const results = profiles.map((user) => saveProfile(user, posts.filter((post) => post.profile === user), source, { rankBy }));
    return { ok: true, command: "import", interface_version: INTERFACE_VERSION, app: APP, kind: "apify_file", profiles: results.map(profileView) };
  }
  const { profile, posts, pinned, source } = readingToPosts(data);
  writeJson(join(profileDir(profile), "leitura.json"), data);
  const result = saveProfile(profile, posts, source, { rankBy, warnings: pinned ? [`${pinned} post(s) fixado(s) ficaram de fora do normal.`] : [] });
  return { ok: true, command: "import", interface_version: INTERFACE_VERSION, app: APP, kind: "reading", profiles: [profileView(result)] };
}

// ---------------------------------------------------------------- comments

async function commentsCommand(positionals, values) {
  if (positionals.length !== 1) throw usage("Informe um post: comments <endereço do post ou Reels>.");
  const { shortcode, url } = parsePost(positionals[0]);
  const max = intOption(values, "max", 100, 10, 500);
  const dir = postDir(shortcode);
  const path = join(dir, "comments.json");
  const cached = readJson(path);
  if (cached && !values.refresh && ageHours(path) < FRESH.comments && (cached.requested ?? 0) >= max) return { ...cached, cached: true };
  const access = await apifyAccess({ api: apifyApi(values["apify-url"]) });
  if (!canCollect(access)) {
    return {
      ok: true,
      command: "comments",
      interface_version: INTERFACE_VERSION,
      app: APP,
      id: shortcode,
      url,
      mode: "manual",
      collected: false,
      next_step: {
        say: "Sem a chave do Apify, os comentários não são colhidos sozinhos. O integrante pode salvar a chave, ou copiar os comentários do post num arquivo de texto que você lê.",
        key: keySetup(),
        paste: `Peça ao integrante para colar os comentários em ${rel(join(dir, "comentarios-colados.txt"))}, um por linha, sem o nome de quem escreveu.`,
      },
    };
  }
  const source = SOURCES.comments;
  const estimate = estimateUsd(source, max);
  if (estimate > (SOURCES.cost_warn_usd ?? 1) && !values["confirm-cost"]) {
    throw new AppError("needs_confirmation", `Colher ${max} comentários deve custar até ${usd(estimate)} no Apify.`, "Diga o valor ao integrante. Com o sim, repita com --confirm-cost; ou peça menos comentários com --max.");
  }
  const collected = await runActor({
    actor: source.actor,
    input: { directUrls: [url], resultsLimit: max, includeNestedComments: false },
    token: access.key,
    maxItems: max,
    maxChargeUsd: chargeCeiling(estimate),
    api: apifyApi(values["apify-url"]),
    label: "comentários",
  });
  const comments = collected.items
    .filter((item) => item && !item.error && typeof item.text === "string")
    .map(normalizeComment)
    .filter((comment) => comment.text)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  const result = {
    ok: true,
    command: "comments",
    interface_version: INTERFACE_VERSION,
    app: APP,
    id: shortcode,
    url,
    requested: max,
    count: comments.length,
    collected_at: today(),
    comments,
    cost: { estimate_usd: estimate, charged_usd: collected.run.usage_usd, run_id: collected.run.id },
    files: { json: rel(path), md: rel(join(dir, "comments.md")) },
    warnings: comments.length < max ? [`Pedi ${max} comentários e vieram ${comments.length}.`] : [],
  };
  writeJson(path, result);
  writeFileAtomic(join(dir, "comments.md"), commentsMarkdown(result));
  return { ...result, cached: false };
}

// ---------------------------------------------------------------- check and list

async function checkCommand(values = {}) {
  const access = await apifyAccess({ api: apifyApi(values["apify-url"]) });
  const ready = canCollect(access);
  return {
    ok: true,
    command: "check",
    interface_version: INTERFACE_VERSION,
    app: APP,
    node: process.versions.node,
    ready: true,
    modes: { manual: true, apify: ready },
    apify_key: ready,
    apify_key_from: access.from,
    apify_setup: ready ? null : keySetup(),
    prices: { checked_on: SOURCES.checked_on ?? null, posts_usd_each: SOURCES.posts?.usd_per_item ?? null, comments_usd_each: SOURCES.comments?.usd_per_item ?? null, confirm_above_usd: SOURCES.cost_warn_usd ?? null },
  };
}

function listCommand() {
  const folder = (...parts) => (existsSync(join(RESEARCH_DIR, ...parts)) ? readdirSync(join(RESEARCH_DIR, ...parts)) : []);
  const profiles = folder("profiles").map((id) => {
    const data = readJson(join(RESEARCH_DIR, "profiles", id, "profile.json"));
    return { id, source: data?.source?.type ?? null, collected_at: data?.source?.collected_at ?? null, reels_normal: data?.baseline?.reels?.value ?? null, md: data ? rel(join(RESEARCH_DIR, "profiles", id, "profile.md")) : null };
  });
  const outliers = folder("outliers").map((id) => {
    const data = readJson(join(RESEARCH_DIR, "outliers", id, "outliers.json"));
    return { id, profiles: (data?.profiles ?? []).map((profile) => profile.id), created_at: data?.created_at ?? null, md: rel(join(RESEARCH_DIR, "outliers", id, "outliers.md")) };
  });
  const posts = folder("posts").map((id) => ({ id, comments: existsSync(join(RESEARCH_DIR, "posts", id, "comments.md")) }));
  return { ok: true, command: "list", interface_version: INTERFACE_VERSION, app: APP, dir: rel(RESEARCH_DIR), profiles, outliers, posts };
}

const HELP = `Pesquisa no Instagram: posts e Reels medidos contra o normal do próprio perfil.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                        A chave do Apify está salva? Mostra os modos e os preços de cada coleta.
  profile <@perfil>            Os últimos posts de um perfil, o normal dele e os que passaram desse normal.
  outliers <@perfil> <@perfil>…  De 2 a 25 perfis: cada post contra o normal do próprio perfil, num ranking só.
  import <arquivo>             Uma leitura feita à mão (capturas de tela lidas pela IA) ou um arquivo de posts já colhido.
  comments <post>              Os comentários de um post ou Reels, sem o nome de quem escreveu.
  list                         O que já foi pesquisado neste projeto.
  help                         Esta ajuda.

Opções
  --posts N                    Posts por perfil, de 5 a 100 (padrão: 30).
  --source auto|apify|reading  De onde vêm os posts. auto (padrão) usa o que o projeto já tem, uma coleta
                               recente ou uma leitura feita à mão, e só colhe pelo Apify o que falta.
  --rank index|multiplier|metric   Ordem do resultado (padrão: index).
  --name <nome>                (outliers) Nome da pasta do resultado.
  --max N                      (comments) Quantos comentários, de 10 a 500 (padrão: 100).
  --confirm-cost               Confirma uma coleta acima do limite de custo, depois do sim do integrante.
  --refresh                    Colhe de novo em vez de reaproveitar o que já foi colhido.
  --json                       Saída em JSON, para a IA e para outros apps.`;

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  const times = (value) => (typeof value === "number" ? `${String(value).replace(".", ",")}× ` : "");
  if (result.mode === "manual") return [result.next_step.say, `Chave: ${result.next_step.key.command}`, result.next_step.reading?.how ?? result.next_step.paste].filter(Boolean).join("\n");
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      return [`Pesquisa no Instagram ${result.app.version} · Node ${result.node}`, `Chave do Apify: ${result.apify_key ? (result.apify_key_from === "cloud_secret" ? "no segredo de rede do ambiente" : `salva (${result.apify_key_from})`) : "ausente"}`, result.apify_setup && (result.apify_setup.command ? `Para salvar: ${result.apify_setup.command}` : result.apify_setup.how)].filter(Boolean).join("\n");
    case "profile": {
      const normal = result.baseline.reels.value ? `normal de ${result.baseline.reels.value} plays em ${result.baseline.reels.n} Reels` : "sem normal de Reels";
      return [`@${result.id}: ${normal}. Resultado: ${result.files.md}`, ...result.top_reels.slice(0, 5).map((item, i) => `${i + 1}. ${times(item.multiplier)}${item.metric ?? ""} plays · ${item.url ?? ""}`), ...warnings].join("\n");
    }
    case "outliers":
      return [`${result.sample.reels} Reels de ${result.sample.profiles} perfis. Resultado: ${result.files.md}`, ...result.top_reels.slice(0, 8).map((item, i) => `${i + 1}. ${times(item.multiplier)}@${item.profile} · ${item.metric ?? ""} plays · ${item.url ?? ""}`), ...warnings].join("\n");
    case "import":
      return result.profiles.map((profile) => `@${profile.id}: ${profile.sample.posts} posts importados. Resultado: ${profile.files.md}`).join("\n");
    case "comments":
      return [`${result.count} comentários → ${result.files.md}`, ...warnings].join("\n");
    case "list":
      return [`Perfis: ${result.profiles.length} · pesquisas: ${result.outliers.length} · posts com comentários: ${result.posts.filter((post) => post.comments).length} (em ${result.dir})`, ...result.profiles.map((profile) => `- @${profile.id} (${profile.source ?? "sem dado"})`)].join("\n");
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || ["help", "--help", "-h"].includes(command)) return { ok: true, command: "help", interface_version: INTERFACE_VERSION, text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (command) {
    case "check":
      return checkCommand(values);
    case "profile":
      return profileCommand(positionals, values);
    case "outliers":
      return outliersCommand(positionals, values);
    case "import":
      return importCommand(positionals, values);
    case "comments":
      return commentsCommand(positionals, values);
    case "list":
      return listCommand();
    default:
      throw usage(`Comando desconhecido: ${command}.`, "Comandos: check, profile, outliers, import, comments, list, help.");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
    .catch((error) => {
      const result = { ok: false, command: process.argv[2] ?? null, interface_version: INTERFACE_VERSION, error: errorOf(error) };
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
      process.exitCode = error instanceof AppError && error.code === "usage" ? 2 : 1;
    });
}
