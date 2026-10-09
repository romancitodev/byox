//! `byox`: tus cursos, tests y pistas desde la terminal.

mod api;
mod author;
mod diag;
mod repo;
mod ui;

use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::process::{Command, ExitCode, Stdio};

// Como println!, pero sin colores si la salida no es una terminal o si está NO_COLOR.
use anstream::{eprintln, println};
use std::thread::sleep;
use std::time::{Duration, Instant};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use owo_colors::OwoColorize;

use api::{Api, Course};
use repo::{Repo, Source};

#[derive(Parser)]
#[command(name = "byox", version, about = "Tus cursos de byox desde la terminal", long_about = None)]
struct Cli {
  /// Curso a usar (por defecto, el del repo en el que estás)
  #[arg(long, short, global = true)]
  course: Option<String>,
  #[command(subcommand)]
  cmd: Option<Cmd>,
}

#[derive(Subcommand)]
enum Cmd {
  /// Dónde estás: progreso, etapa actual y resultado del último push (por defecto)
  Status,
  /// Tus cursos
  Courses,
  /// Instrucciones de una etapa (por defecto, la actual)
  Show { n: Option<u32> },
  /// Corre los tests en Docker, en la misma imagen que el CI (sin números: la etapa actual)
  Test {
    n: Vec<u32>,
    /// Todas las etapas
    #[arg(long, short)]
    all: bool,
    /// Sin Docker: con `sh .course/run.sh` y tus herramientas (necesita Git Bash en Windows)
    #[arg(long)]
    local: bool,
  },
  /// Espera al CI del último push y te dice qué pasó
  Watch,
  /// Pide la siguiente pista de una etapa
  Hint { n: Option<u32> },
  /// La salida del último test de una etapa en el CI
  Log { n: Option<u32> },
  /// Abre la etapa en la web
  Open { n: Option<u32> },
  /// Clona tu repo de un curso
  Clone { slug: String },
  /// Arranca un curso escrito a mano desde una plantilla que ya anda, y lo clona
  New {
    slug: String,
    /// python, rust, go o node
    #[arg(long, short, default_value = "python")]
    lang: String,
    /// Título del curso (por defecto, el slug)
    #[arg(long, short)]
    title: Option<String>,
    /// No clonarlo
    #[arg(long)]
    no_clone: bool,
  },
  /// Cómo quedó el curso que estás escribiendo: formato y verificación (esqueleto falla, solución pasa)
  Check {
    slug: Option<String>,
    /// No esperar a que termine la verificación
    #[arg(long)]
    no_wait: bool,
  },
  /// Empieza un curso: crea tu repo con los issues (tiene que estar verificado)
  Start { slug: String },
  /// Exporta un curso a un código para compartirlo (lo copia al portapapeles)
  Export {
    slug: Option<String>,
    /// Guardarlo en un archivo (.byox) en vez de copiarlo
    #[arg(long, short)]
    output: Option<std::path::PathBuf>,
  },
  /// Importa un curso desde un código, un archivo .byox o el portapapeles
  Import {
    /// El código, un archivo, o `-` para leerlo de stdin (sin nada: el portapapeles)
    code: Option<String>,
    /// Importarlo con otro nombre
    #[arg(long = "as")]
    name: Option<String>,
    /// No preguntar
    #[arg(long, short)]
    yes: bool,
    /// No esperar a que se verifique
    #[arg(long)]
    no_wait: bool,
  },
  /// El formato de un curso y cómo escribirlo
  Guide,
  /// Guarda tu token personal de byox (lo creas en la web, en Cuenta → Tokens)
  Login {
    /// El token `byox_…`
    token: String,
  },
}

fn main() -> ExitCode {
  // Consolas viejas de Windows; anstream además saca los colores si la salida no es una terminal.
  let _ = enable_ansi_support::enable_ansi_support();
  match run(Cli::parse()) {
    Ok(code) => code,
    Err(e) => {
      eprintln!("{} {e:#}", "error:".red().bold());
      ExitCode::from(2)
    }
  }
}

fn run(cli: Cli) -> Result<ExitCode> {
  let api = Api::new();
  let slug = || -> Result<String> {
    match &cli.course {
      Some(s) => Ok(s.clone()),
      None => Ok(Repo::find()?.slug),
    }
  };
  match cli.cmd.unwrap_or(Cmd::Status) {
    Cmd::Courses => courses(&api),
    Cmd::Clone { slug } => clone(&api, &slug),
    Cmd::Status => {
      if cli.course.is_none() && Repo::find().is_err() {
        return courses(&api);
      }
      status(&api, &slug()?)
    }
    Cmd::Show { n } => show(&api, &slug()?, n),
    Cmd::Test { n, all, local } => test(&api, cli.course.as_deref(), n, all, local),
    Cmd::Watch => watch(&api),
    Cmd::Hint { n } => hint(&api, &slug()?, n),
    Cmd::Log { n } => log(&api, &slug()?, n),
    Cmd::Open { n } => open(&api, &slug()?, n),
    Cmd::New { slug, lang, title, no_clone } => author::new(&api, &slug, &lang, title.as_deref(), !no_clone),
    Cmd::Check { slug, no_wait } => {
      // El curso que estás escribiendo: el argumento, --course o el repo fuente en el que estás parado.
      let source = Source::find();
      let unpushed = source.as_ref().map_or(0, |s| s.unpushed);
      let slug = slug.or(cli.course.clone()).or(source.map(|s| s.slug)).context(
        "no estás dentro del repo fuente de un curso (no encontré course.yaml). Pasá el nombre: byox check <curso>",
      )?;
      author::check(&api, &slug, unpushed, !no_wait)
    }
    Cmd::Start { slug } => author::start(&api, &slug),
    Cmd::Export { slug, output } => {
      let slug = match slug.or(cli.course.clone()).or(Source::find().map(|s| s.slug)) {
        Some(s) => s,
        None => Repo::find().map(|r| r.slug).context("¿qué curso? byox export <curso>")?,
      };
      author::export(&api, &slug, output.as_deref())
    }
    Cmd::Import { code, name, yes, no_wait } => author::import(&api, code.as_deref(), name.as_deref(), yes, !no_wait),
    Cmd::Guide => author::guide(&api),
    Cmd::Login { token } => {
      if !token.trim().starts_with("byox_") {
        bail!("ese no parece un token de byox (empieza con byox_)");
      }
      let file = api::save_token(&token)?;
      println!("Listo: guardé el token en {}", file.display());
      Ok(ExitCode::SUCCESS)
    }
  }
}

fn pick(c: &Course, n: Option<u32>) -> Result<u32> {
  match n {
    Some(n) if c.issue(n).is_some() => Ok(n),
    Some(n) => bail!("el curso no tiene la etapa #{n}"),
    None => c.current().map(|i| i.n).context("no hay etapas disponibles: ¡terminaste el curso!"),
  }
}

fn courses(api: &Api) -> Result<ExitCode> {
  let list = api.courses()?;
  if list.is_empty() {
    println!("Todavía no hay cursos. Pedile a la IA que arme uno con el MCP de byox, escribí uno con `byox new` o importá uno con `byox import`.");
  }
  for c in list {
    let state = if !c.started {
      "sin empezar".bright_black().to_string()
    } else if c.done == c.total {
      "terminado".green().to_string()
    } else {
      format!("{}/{}", c.done, c.total).yellow().to_string()
    };
    let hand = if c.origin.as_deref() == Some("human") { "✍".magenta().to_string() } else { " ".into() };
    println!("{hand} {:<30} {:>12}  {}", c.title.bold(), state, c.description.bright_black());
    if c.started && c.done < c.total {
      println!("  {:<30} {:>12}  {}", "", "", format!("byox clone {}", c.slug).bright_black());
    }
  }
  Ok(ExitCode::SUCCESS)
}

fn status(api: &Api, slug: &str) -> Result<ExitCode> {
  let c = api.course(slug)?;
  if !c.started {
    println!("{} todavía no lo empezaste. Abrilo en la web para empezarlo: {}", c.title.bold(), api.web_url(&format!("/app/c/{slug}")));
    return Ok(ExitCode::SUCCESS);
  }
  let cur = c.current().map(|i| i.n);
  println!("{}  {}", c.title.bold(), c.image.bright_black());
  println!("{}  {} de {} etapas", ui::segs(&c, cur), c.done(), c.issues.len());

  if let Some(i) = c.current() {
    let ms = c.milestones.iter().find(|m| m.id == i.milestone).map(|m| m.title.as_str()).unwrap_or("");
    println!("\n{} {} {}  {}", "→".yellow().bold(), format!("#{}", i.n).bright_black(), i.title.bold(), ms.bright_black());
    if let Some(r) = &i.result {
      ui::print_result(r, "  ");
    }
  } else {
    println!("\n{}", "🏁 Terminaste el curso.".green().bold());
  }

  let fails: Vec<_> = c.issues.iter().filter(|i| i.failing() && Some(i.n) != cur).collect();
  if !fails.is_empty() {
    println!("\n{}", "También fallan:".red().bold());
    for i in fails {
      println!("  {} #{} {}", ui::icon(i), i.n, i.title);
      if let Some(r) = &i.result {
        ui::print_result(r, "    ");
      }
    }
  }
  let others: Vec<String> =
    c.issues.iter().filter(|i| i.state == "ready" && Some(i.n) != cur).map(|i| format!("#{}", i.n)).collect();
  if !others.is_empty() {
    println!("\n{} {}", "También disponibles:".bright_black(), others.join(", "));
  }

  if let Ok(st) = api.status(slug) {
    if let Some(run) = st.run {
      let state = match run.state.as_str() {
        "pending" => "corriendo tests…".yellow().to_string(),
        "none" => "sin tests".bright_black().to_string(),
        "success" => "tests corridos".green().to_string(),
        _ => "el run se cortó (mirá los logs)".red().to_string(),
      };
      println!("\n{} {} {} · {} · {}", "Último push".bright_black(), (&run.sha[..7]).cyan(), run.message, ago_or(&run.at), state);
    }
  }
  if let Ok(repo) = Repo::find() {
    let n = repo.unpushed();
    if n > 0 {
      println!("{} {} sin pushear. `git push` y después `byox watch`.", "!".yellow().bold(), if n == 1 { "1 commit".into() } else { format!("{n} commits") });
    }
  }
  Ok(ExitCode::SUCCESS)
}

fn ago_or(iso: &str) -> String {
  let a = ui::ago(iso);
  if a.is_empty() { iso.to_string() } else { a }
}

fn show(api: &Api, slug: &str, n: Option<u32>) -> Result<ExitCode> {
  let c = api.course(slug)?;
  let n = pick(&c, n)?;
  let i = c.issue(n).unwrap();
  let d = api.issue(slug, n)?;
  println!("{} {}  {}", format!("#{n}").bright_black(), i.title.bold(), ui::state_label(i));
  if !i.deps.is_empty() {
    let deps: Vec<String> = i.deps.iter().map(|d| format!("#{d}")).collect();
    println!("{} {}", "Necesita".bright_black(), deps.join(", "));
  }
  if let Some(r) = &d.result {
    if i.state != "done" {
      ui::print_result(r, "");
    }
  }
  ui::print_markdown(&d.markdown);
  println!("\n{} byox test {n}   {} byox hint {n}   {} {}", "Probalo:".bright_black(), "Pista:".bright_black(), "Web:".bright_black(), d.url.bright_black());
  Ok(ExitCode::SUCCESS)
}

/// Variables que mandan las cachés a /cache, igual que el CI (ver CACHE_ENV en el MCP).
const CACHE_ENV: [(&str, &str); 6] = [
  ("CARGO_HOME", "/cache/cargo"),
  ("CARGO_TARGET_DIR", "/cache/target"),
  ("PIP_CACHE_DIR", "/cache/pip"),
  ("GOCACHE", "/cache/go-build"),
  ("GOMODCACHE", "/cache/go-mod"),
  ("npm_config_cache", "/cache/npm"),
];

fn test(api: &Api, course: Option<&str>, n: Vec<u32>, all: bool, local: bool) -> Result<ExitCode> {
  let repo = Repo::find()?;
  let slug = course.map(String::from).unwrap_or_else(|| repo.slug.clone());
  let ids: Vec<String> = if all {
    vec![]
  } else if n.is_empty() {
    // Sin números: la etapa actual (si la API no está, todas).
    match api.course(&slug).ok().and_then(|c| c.current().map(|i| i.n)) {
      Some(cur) => vec![cur.to_string()],
      None => vec![],
    }
  } else {
    n.iter().map(u32::to_string).collect()
  };
  let label = if ids.is_empty() { "todas las etapas".to_string() } else { format!("#{}", ids.join(", #")) };
  // Todo a stdout (2>&1 adentro) para poder mostrarlo en vivo y después decir dónde falló.
  let script = format!("sh .course/run.sh {} 2>&1", ids.join(" "));
  let mut cmd = if local {
    println!("{} {label} con sh .course/run.sh", "▶".cyan());
    let mut c = Command::new("sh");
    c.args(["-c", &script]).current_dir(&repo.root);
    c
  } else {
    println!("{} {label} en Docker ({}), igual que el CI", "▶".cyan(), repo.image);
    let mut c = Command::new("docker");
    c.args(["run", "--rm", "-w", "/work", "-e", "CARGO_TERM_COLOR=always"]);
    c.arg("-v").arg(format!("{}:/work", repo.root.display()));
    c.arg("-v").arg(format!("byox-cache-{slug}:/cache"));
    for (k, v) in CACHE_ENV {
      c.arg("-e").arg(format!("{k}={v}"));
    }
    c.args([repo.image.as_str(), "sh", "-c", &script]);
    c
  };
  let mut child = cmd.stdout(Stdio::piped()).spawn().with_context(|| {
    if local {
      "no encontré `sh`. En Windows instalá Git for Windows, o usá `byox test` sin --local (corre en Docker)"
    } else {
      "no pude correr docker. ¿Está abierto Docker Desktop?"
    }
  })?;
  let mut sections: Vec<(String, bool, String)> = vec![];
  let mut chunk = String::new();
  for line in BufReader::new(child.stdout.take().unwrap()).lines() {
    let line = line.unwrap_or_default();
    println!("{line}");
    let plain = diag::strip_ansi(&line);
    // run.sh cierra cada etapa con "✅ #7 título" o "❌ #7 título".
    let mark = plain.strip_prefix("✅ #").map(|r| (true, r)).or_else(|| plain.strip_prefix("❌ #").map(|r| (false, r)));
    match mark {
      Some((ok, rest)) => {
        let title = rest.split_once(' ').map_or("", |(_, t)| t);
        sections.push((title.to_string(), ok, std::mem::take(&mut chunk)));
      }
      None => {
        chunk.push_str(&plain);
        chunk.push('\n');
      }
    }
  }
  let status = child.wait()?;

  let failed: Vec<_> = sections.iter().filter(|(_, ok, _)| !ok).collect();
  if failed.is_empty() && status.success() {
    println!("\n{} Pasa. Pusheá a main y corré `byox watch` para ver cómo se cierra.", "✓".green().bold());
    return Ok(ExitCode::SUCCESS);
  }
  println!();
  for (title, _, out) in &failed {
    let d = diag::diagnose(out);
    if d.kind == "todo" {
      let at = d.location.map(|l| format!(" en {}", l.cyan())).unwrap_or_default();
      println!("{} {}: sin empezar, el test llega al todo!(){at}", "○".bright_black(), title.bold());
    } else {
      println!("{} {}", "✗".red().bold(), title.bold());
      println!("  {}", d.message.bold());
      if let Some(l) = d.location {
        println!("  {} {}", "en".bright_black(), l.cyan().underline());
      }
    }
  }
  if failed.is_empty() {
    println!("{} el comando terminó con error antes de correr los tests (¿falló el setup?).", "✗".red().bold());
  }
  Ok(ExitCode::from(1))
}

fn watch(api: &Api) -> Result<ExitCode> {
  let repo = Repo::find()?;
  if repo.unpushed() > 0 {
    bail!("tenés commits sin pushear. Hacé `git push` primero");
  }
  let head = repo.head().context("no pude leer el commit actual")?;
  let before = api.course(&repo.slug)?;
  println!("{} esperando el CI de {}…", "◌".cyan(), (&head[..7]).cyan());
  let start = Instant::now();
  loop {
    let st = api.status(&repo.slug)?;
    if let Some(run) = &st.run {
      if run.sha == head && run.state != "pending" && run.state != "none" {
        break;
      }
      if run.sha == head && run.state == "pending" && start.elapsed().as_secs() % 15 == 0 {
        println!("{} corriendo tests…", "◌".yellow());
      }
    }
    if start.elapsed() > Duration::from_secs(20 * 60) {
      bail!("el CI tarda más de 20 minutos. Mirá el runner: docker compose logs runner");
    }
    sleep(Duration::from_secs(3));
  }
  // El reporte llega en el último job: darle un momento para que el MCP lo guarde.
  sleep(Duration::from_secs(2));
  let after = api.course(&repo.slug)?;
  let closed: HashSet<u32> = before.issues.iter().filter(|i| i.state != "done").map(|i| i.n).collect();
  let newly: Vec<_> = after.issues.iter().filter(|i| i.state == "done" && closed.contains(&i.n)).collect();
  let unlocked: Vec<_> = after
    .issues
    .iter()
    .filter(|i| i.state == "ready" && before.issue(i.n).is_some_and(|b| b.state == "locked"))
    .collect();
  for i in &newly {
    println!("{} completaste #{} {}", "✓".green().bold(), i.n, i.title.bold());
  }
  for i in &unlocked {
    println!("{} se abrió #{} {}", "→".yellow().bold(), i.n, i.title);
  }
  let fails: Vec<_> = after.issues.iter().filter(|i| i.state == "ready" && i.failing()).collect();
  for i in &fails {
    println!("{} #{} {}", "✗".red().bold(), i.n, i.title.bold());
    if let Some(r) = &i.result {
      ui::print_result(r, "  ");
    }
    println!("  {} byox log {}", "salida completa:".bright_black(), i.n);
  }
  if newly.is_empty() && fails.is_empty() {
    println!("{} no se cerró ninguna etapa en este push.", "·".bright_black());
  }
  println!("{} {}/{} etapas", ui::segs(&after, after.current().map(|i| i.n)), after.done(), after.issues.len());
  Ok(if fails.is_empty() { ExitCode::SUCCESS } else { ExitCode::from(1) })
}

fn hint(api: &Api, slug: &str, n: Option<u32>) -> Result<ExitCode> {
  let c = api.course(slug)?;
  let n = pick(&c, n)?;
  let had = api.issue(slug, n)?.hints.len();
  if had as u32 >= c.issue(n).unwrap().hints {
    println!("Ya tenés todas las pistas de #{n}:");
    for h in api.issue(slug, n)?.hints {
      println!("\n{} {}", format!("Pista {}", h.k).yellow().bold(), "");
      ui::print_markdown(&h.markdown);
    }
    return Ok(ExitCode::SUCCESS);
  }
  api.ask_hint(slug, n)?;
  println!("{} pidiendo la pista {} de #{n}…", "◌".cyan(), had + 1);
  for _ in 0..40 {
    sleep(Duration::from_secs(2));
    let d = api.issue(slug, n)?;
    if d.hints.len() > had {
      let h = d.hints.last().unwrap();
      println!("\n{}", format!("💡 Pista {} de {}", h.k, c.issue(n).unwrap().hints).yellow().bold());
      ui::print_markdown(&h.markdown);
      return Ok(ExitCode::SUCCESS);
    }
  }
  bail!("la pista no llegó en un minuto y medio. ¿Está andando el runner? (docker compose logs runner)")
}

fn log(api: &Api, slug: &str, n: Option<u32>) -> Result<ExitCode> {
  let c = api.course(slug)?;
  let n = pick(&c, n)?;
  let d = api.issue(slug, n)?;
  let Some(r) = d.result else {
    println!("#{n} todavía no se probó en el CI. Pusheá a main.");
    return Ok(ExitCode::SUCCESS);
  };
  ui::print_result(&r, "");
  println!();
  ui::print_log(&r);
  if let Some(u) = r.run_url {
    println!("\n{} {}", "Run completo:".bright_black(), u);
  }
  Ok(ExitCode::SUCCESS)
}

fn open(api: &Api, slug: &str, n: Option<u32>) -> Result<ExitCode> {
  let c = api.course(slug)?;
  let path = match n.or_else(|| c.current().map(|i| i.n)) {
    Some(n) => format!("/app/c/{slug}/{n}"),
    None => format!("/app/c/{slug}"),
  };
  let url = api.web_url(&path);
  #[cfg(windows)]
  let r = Command::new("cmd").args(["/C", "start", "", &url]).status();
  #[cfg(target_os = "macos")]
  let r = Command::new("open").arg(&url).status();
  #[cfg(all(unix, not(target_os = "macos")))]
  let r = Command::new("xdg-open").arg(&url).status();
  if r.is_err() {
    println!("{url}");
  }
  Ok(ExitCode::SUCCESS)
}

fn clone(api: &Api, slug: &str) -> Result<ExitCode> {
  let c = api.course(slug)?;
  if !c.started {
    bail!("todavía no empezaste {slug}. Empezalo desde la web: {}", api.web_url(&format!("/app/c/{slug}")));
  }
  // El provider "generic" evita que Git Credential Manager sondee el host en cada pull (2 warnings y varios segundos).
  let ok = Command::new("git").args(["clone", "-c", "credential.provider=generic", &c.clone_url]).status()?.success();
  if ok {
    println!("\n{} cd {slug} && byox", "Listo:".green().bold());
  }
  Ok(if ok { ExitCode::SUCCESS } else { ExitCode::from(1) })
}
