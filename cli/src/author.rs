//! Escribir cursos a mano y compartirlos: `byox new`, `check`, `start`, `export`, `import` y `guide`.

use std::io::{IsTerminal, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use anstream::{eprintln, println};
use anyhow::{Context, Result, bail};
use owo_colors::OwoColorize;

use crate::api::{Api, AuthorStatus};
use crate::{diag, ui};

const CODE_PREFIX: &str = "byox1-";

fn origin_badge(origin: Option<&str>) -> String {
  match origin {
    Some("human") => format!(" {}", "✍ hecho a mano".magenta()),
    Some("ai") => format!(" {}", "✦ escrito con IA".bright_black()),
    _ => String::new(),
  }
}

pub fn new(api: &Api, slug: &str, lang: &str, title: Option<&str>, clone: bool) -> Result<ExitCode> {
  let templates = api.templates()?;
  let Some(t) = templates.iter().find(|t| t.lang == lang) else {
    let langs: Vec<_> = templates.iter().map(|t| t.lang.as_str()).collect();
    bail!("no hay plantilla para \"{lang}\". Hay: {}", langs.join(", "));
  };
  let c = api.new_course(slug, lang, title)?;
  println!(
    "{} creé {} desde la plantilla de {} ({}): dos issues, tests y solución que ya pasan.",
    "✓".green().bold(),
    c.slug.bold(),
    t.label,
    t.image.bright_black()
  );
  if clone {
    let ok = Command::new("git").args(["clone", "-q", &c.clone_url]).status()?.success();
    if !ok {
      bail!("no pude clonarlo. Probá a mano: git clone {}", c.clone_url);
    }
  }
  println!();
  let first = if clone { format!("cd {}", c.slug) } else { format!("git clone {}", c.clone_url) };
  let steps = [
    (first.as_str(), ""),
    ("", "cambiá course.yaml, issues/, files/ y solution/ por tu curso"),
    ("git push", "cada push se verifica solo"),
    ("byox check", "qué falla y dónde"),
    (&*format!("byox start {}", c.slug), "lo empezás cuando esté verificado"),
    ("byox guide", "el formato completo"),
  ];
  let width = steps.iter().map(|(cmd, _)| cmd.chars().count()).max().unwrap_or(0).min(32);
  for (cmd, what) in steps {
    if cmd.is_empty() {
      println!("  {}", what.bright_black());
    } else {
      println!("  {}  {}", format!("{cmd:<width$}").cyan(), what.bright_black());
    }
  }
  Ok(ExitCode::SUCCESS)
}

/// Espera a que termine la verificación del último commit (y la arranca si nadie lo verificó).
fn wait_verified(api: &Api, slug: &str) -> Result<AuthorStatus> {
  let mut st = api.author_status(slug)?;
  if st.verify.state == "none" && !st.verify.busy && st.errors.is_empty() {
    api.verify(slug)?;
    st = api.author_status(slug)?;
  }
  if !st.verify.busy && st.verify.state != "pending" {
    return Ok(st);
  }
  println!("{} verificando {}: esqueleto y solución en Docker…", "◌".cyan(), (&st.sha[..7]).cyan());
  let start = Instant::now();
  while st.verify.busy || st.verify.state == "pending" {
    if start.elapsed() > Duration::from_secs(30 * 60) {
      bail!("la verificación tarda más de 30 minutos. Mirá los logs: docker compose logs mcp");
    }
    sleep(Duration::from_secs(2));
    st = api.author_status(slug)?;
  }
  Ok(st)
}

pub fn check(api: &Api, slug: &str, unpushed: usize, wait: bool) -> Result<ExitCode> {
  if unpushed > 0 {
    let s = if unpushed == 1 { "" } else { "s" };
    eprintln!(
      "{} tenés {unpushed} commit{s} sin pushear: check mira lo que está en Forgejo. Hacé {} primero.",
      "!".yellow().bold(),
      "git push".cyan()
    );
  }
  let st = if wait { wait_verified(api, slug)? } else { api.author_status(slug)? };
  println!(
    "{} {} {}{}",
    st.title.bold(),
    (&st.sha[..7.min(st.sha.len())]).cyan(),
    st.message.bright_black(),
    origin_badge(st.origin.as_deref())
  );

  if !st.errors.is_empty() {
    println!("\n{}", "Formato".bold().underline());
    for e in &st.errors {
      println!("  {} {e}", "✗".red().bold());
    }
  }
  for w in &st.warnings {
    println!("  {} {w}", "!".yellow());
  }

  let current = st.last.as_ref().filter(|v| v.sha == st.sha);
  if let Some(v) = current {
    let image = v.image.as_deref().map(|i| format!(" en {i}")).unwrap_or_default();
    println!("\n{}{}", "Verificación".bold().underline(), image.bright_black());
    for e in &v.errors {
      if !st.errors.contains(e) {
        println!("  {} {e}", "✗".red().bold());
      }
    }
    let width = v.stages.iter().map(|s| s.title.chars().count()).max().unwrap_or(0).min(40);
    for s in &v.stages {
      let mark = if s.ok { "✓".green().to_string() } else { "✗".red().bold().to_string() };
      let skel = if s.skeleton == "falla" { "falla".green().to_string() } else { "pasa".red().bold().to_string() };
      let sol = if s.solution == "pasa" { "pasa".green().to_string() } else { "falla".red().bold().to_string() };
      let title: String = s.title.chars().take(40).collect();
      println!(
        "  {mark} #{:<3} {:<width$}  {} {skel}  {} {sol}",
        s.id,
        title,
        "esqueleto".bright_black(),
        "solución".bright_black()
      );
      if s.ok {
        continue;
      }
      if s.skeleton == "pasa" {
        println!("      {}", "pasa sin hacer nada: el test no prueba nada o files/ ya lo resuelve".yellow());
      }
      if s.solution == "falla" {
        if let Some(log) = &s.log {
          let clean = diag::strip_ansi(log);
          let d = diag::diagnose(&clean);
          let at = d.location.map(|w| format!(" en {}", w.cyan())).unwrap_or_default();
          println!("      {} {}{at}", "con la solución:".red(), d.message.bold());
          for line in clean.lines().filter(|l| !l.trim().is_empty()).rev().take(6).collect::<Vec<_>>().into_iter().rev() {
            println!("      {}", line.bright_black());
          }
        }
      }
    }
  }

  println!();
  let state = current.map(|v| v.state.as_str()).unwrap_or(st.verify.state.as_str());
  match state {
    "success" if st.started => println!("{} verificado. Ya lo empezaste: los cambios llegan a tu repo con upgrade_course o reset.", "✓".green().bold()),
    "success" => println!("{} verificado. Empezalo con {}", "✓".green().bold(), format!("byox start {}", st.slug).cyan()),
    "pending" => println!("{} verificando… volvé a correr {}", "◌".yellow(), "byox check".cyan()),
    "none" if !st.errors.is_empty() => println!("{} arreglá el formato y pusheá.", "✗".red().bold()),
    "none" => println!("{} sin verificar. Corré {}", "·".bright_black(), "byox check".cyan()),
    _ => println!("{} no está verificado: arreglalo y pusheá, se verifica solo.", "✗".red().bold()),
  }
  Ok(if state == "success" { ExitCode::SUCCESS } else { ExitCode::from(1) })
}

pub fn start(api: &Api, slug: &str) -> Result<ExitCode> {
  api.start(slug)?;
  println!("{} empezaste {}. Clonalo con {}", "✓".green().bold(), slug.bold(), format!("byox clone {slug}").cyan());
  Ok(ExitCode::SUCCESS)
}

pub fn guide(api: &Api) -> Result<ExitCode> {
  ui::print_markdown(&api.guide()?);
  Ok(ExitCode::SUCCESS)
}

// ── Compartir ────────────────────────────────────────────────────────────────

/// Copia al portapapeles con la herramienta del sistema. Devuelve false si no hay ninguna.
fn copy(text: &str) -> bool {
  let tools: &[(&str, &[&str])] = if cfg!(windows) {
    &[("clip", &[])]
  } else if cfg!(target_os = "macos") {
    &[("pbcopy", &[])]
  } else {
    &[("wl-copy", &[]), ("xclip", &["-selection", "clipboard"]), ("xsel", &["--clipboard", "--input"])]
  };
  for (cmd, args) in tools {
    let Ok(mut child) = Command::new(cmd).args(*args).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    else {
      continue;
    };
    let wrote = child.stdin.take().is_some_and(|mut s| s.write_all(text.as_bytes()).is_ok());
    if wrote && child.wait().is_ok_and(|s| s.success()) {
      return true;
    }
  }
  false
}

fn paste() -> Option<String> {
  let out = if cfg!(windows) {
    Command::new("powershell").args(["-NoProfile", "-Command", "Get-Clipboard -Raw"]).output()
  } else if cfg!(target_os = "macos") {
    Command::new("pbpaste").output()
  } else {
    Command::new("wl-paste").output().or_else(|_| Command::new("xclip").args(["-selection", "clipboard", "-o"]).output())
  };
  out.ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
}

pub fn export(api: &Api, slug: &str, output: Option<&Path>) -> Result<ExitCode> {
  let e = api.export(slug)?;
  let kb = e.bytes.div_ceil(1024);
  let summary = format!("{} @ {}: {} archivos, {kb} KB", e.title.bold(), (&e.sha[..7]).cyan(), e.files);
  let warn = || {
    if !e.verified {
      eprintln!("{} el último commit no está verificado: quien lo importe lo va a verificar igual.", "!".yellow().bold());
    }
  };
  if let Some(path) = output {
    std::fs::write(path, format!("{}\n", e.code)).with_context(|| format!("no pude escribir {}", path.display()))?;
    println!("{} {summary} → {}", "✓".green().bold(), path.display().to_string().cyan());
    println!("  {}", format!("byox import {}", path.display()).bright_black());
    warn();
    return Ok(ExitCode::SUCCESS);
  }
  if !std::io::stdout().is_terminal() {
    // `byox export x > curso.byox` o `byox export x | ...`: sólo el código.
    std::io::stdout().write_all(format!("{}\n", e.code).as_bytes())?;
    return Ok(ExitCode::SUCCESS);
  }
  if copy(&e.code) {
    println!("{} copié el código de {summary}.", "✓".green().bold());
    println!("  Quien lo reciba lo pega en {} o en la web (Importar curso).", "byox import".cyan());
    if kb > 8 {
      println!(
        "  {}",
        format!("Es largo para un chat: pasalo como archivo con byox export {slug} -o {}", e.filename).bright_black()
      );
    }
  } else {
    println!("{}", e.code);
    eprintln!("{summary}. Guardalo en un archivo con -o {}", e.filename);
  }
  warn();
  Ok(ExitCode::SUCCESS)
}

/// El código sale del argumento (el código o un archivo), de stdin o del portapapeles.
fn read_code(arg: Option<&str>) -> Result<String> {
  let stdin = || -> Result<String> {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s)?;
    Ok(s)
  };
  // Sin argumento: lo que entra por stdin (`... | byox import`) y, si no entra nada, el portapapeles.
  let piped = if arg.is_none() && !std::io::stdin().is_terminal() { stdin()? } else { String::new() };
  let raw = match arg {
    Some("-") => stdin()?,
    Some(a) if a.trim_start().starts_with(CODE_PREFIX) => a.to_string(),
    Some(a) => {
      let p = PathBuf::from(a);
      std::fs::read_to_string(&p).with_context(|| format!("{a} no es un código de byox ni un archivo que pueda leer"))?
    }
    None if !piped.trim().is_empty() => piped,
    None => {
      let s = paste().unwrap_or_default();
      if !s.trim_start().starts_with(CODE_PREFIX) {
        bail!("pasame el código o un archivo .byox: byox import <código|archivo>. (En el portapapeles no hay un código de byox.)");
      }
      println!("{} uso el código del portapapeles.", "·".bright_black());
      s
    }
  };
  let code: String = raw.split_whitespace().collect();
  if !code.starts_with(CODE_PREFIX) {
    bail!("eso no es un código de byox: tiene que empezar con {CODE_PREFIX}");
  }
  Ok(code)
}

fn confirm(question: &str) -> Result<bool> {
  print!("{question} [s/N] ");
  std::io::stdout().flush()?;
  let mut answer = String::new();
  std::io::stdin().read_line(&mut answer)?;
  Ok(matches!(answer.trim().to_lowercase().as_str(), "s" | "si" | "sí" | "y" | "yes"))
}

pub fn import(api: &Api, arg: Option<&str>, name: Option<&str>, yes: bool, wait: bool) -> Result<ExitCode> {
  let code = read_code(arg)?;
  let p = api.preview(&code)?;
  println!("{}{}", p.title.bold(), origin_badge(p.origin.as_deref()));
  if !p.description.is_empty() {
    println!("{}", p.description);
  }
  let by = p.author.as_deref().or(p.exported_by.as_deref()).map(|a| format!(" · de {a}")).unwrap_or_default();
  let by = if p.verified { format!("{by} · verificado por quien lo compartió") } else { by };
  println!(
    "{}",
    format!("{} etapas en {} milestones · {} archivos · {}{by}", p.issues, p.milestones.len(), p.files, p.image.as_deref().unwrap_or("?"))
      .bright_black()
  );
  if !p.milestones.is_empty() {
    println!("{}", p.milestones.join(" → ").bright_black());
  }
  if !p.errors.is_empty() {
    for e in &p.errors {
      println!("  {} {e}", "✗".red().bold());
    }
    bail!("el curso del código no es válido");
  }
  let slug = match name {
    Some(n) => n.to_string(),
    None if p.exists => {
      println!(
        "{} ya tenés un curso {}: lo importo como {} (otro nombre con --as).",
        "!".yellow().bold(),
        p.slug,
        p.suggested_slug.bold()
      );
      p.suggested_slug.clone()
    }
    None => p.slug.clone(),
  };
  println!(
    "{}",
    "Los tests del curso corren en tu Docker: importá códigos de gente en la que confiás.".bright_black()
  );
  if !yes && !confirm(&format!("¿Importarlo como {slug}?"))? {
    println!("No importé nada.");
    return Ok(ExitCode::SUCCESS);
  }
  let r = api.import(&code, &slug)?;
  println!("{} importé {} en cursos/{}", "✓".green().bold(), r.title.bold(), r.slug);
  if !wait {
    println!("  Se está verificando. Mirá cómo va con {}", format!("byox check {}", r.slug).cyan());
    return Ok(ExitCode::SUCCESS);
  }
  let st = wait_verified(api, &r.slug)?;
  match st.verify.state.as_str() {
    "success" => {
      println!("{} verificado en tu máquina. Empezalo con {}", "✓".green().bold(), format!("byox start {}", r.slug).cyan());
      Ok(ExitCode::SUCCESS)
    }
    _ => {
      println!("{} no pasó la verificación acá. Mirá qué falla con {}", "✗".red().bold(), format!("byox check {}", r.slug).cyan());
      Ok(ExitCode::from(1))
    }
  }
}
