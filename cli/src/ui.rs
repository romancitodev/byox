//! Cómo se ve byox en la terminal: estados, barras, errores y markdown simple.

use anstream::println;
use owo_colors::OwoColorize;

use crate::api::{Course, Issue, TestResult};

pub fn ago(iso: &str) -> String {
  let Ok(secs) = parse_age(iso) else { return String::new() };
  match secs {
    s if s < 60 => "recién".into(),
    s if s < 3600 => format!("hace {} min", s / 60),
    s if s < 86_400 => format!("hace {} h", s / 3600),
    s if s < 172_800 => "ayer".into(),
    s => format!("hace {} días", s / 86_400),
  }
}

/// Segundos desde una fecha RFC 3339 (`2026-10-07T00:11:45.625Z` o con offset), sin dependencias.
fn parse_age(iso: &str) -> Result<i64, ()> {
  let n = |a: usize, b: usize| iso.get(a..b).and_then(|s| s.parse::<i64>().ok()).ok_or(());
  let (y, mo, d, h, mi, s) = (n(0, 4)?, n(5, 7)?, n(8, 10)?, n(11, 13)?, n(14, 16)?, n(17, 19)?);
  // Offset: buscar el último + o - después de la hora.
  let tail = &iso[19..];
  let off = match tail.rfind(['+', '-']) {
    Some(k) if tail.len() >= k + 6 => {
      let sign = if &tail[k..k + 1] == "-" { -1 } else { 1 };
      let oh: i64 = tail[k + 1..k + 3].parse().map_err(|_| ())?;
      let om: i64 = tail[k + 4..k + 6].parse().map_err(|_| ())?;
      sign * (oh * 3600 + om * 60)
    }
    _ => 0,
  };
  // Días desde 1970 (algoritmo de Howard Hinnant).
  let (yy, mm) = if mo <= 2 { (y - 1, mo + 9) } else { (y, mo - 3) };
  let era = yy.div_euclid(400);
  let yoe = yy - era * 400;
  let doy = (153 * mm + 2) / 5 + d - 1;
  let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  let days = era * 146_097 + doe - 719_468;
  let then = days * 86_400 + h * 3600 + mi * 60 + s - off;
  let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_| ())?.as_secs() as i64;
  Ok((now - then).max(0))
}

pub fn segs(c: &Course, cur: Option<u32>) -> String {
  c.issues
    .iter()
    .map(|i| {
      let block = "■";
      match i.state.as_str() {
        "done" => block.green().to_string(),
        _ if Some(i.n) == cur => block.bright_yellow().to_string(),
        "ready" if i.failing() => block.red().to_string(),
        "ready" => block.yellow().to_string(),
        _ => "□".bright_black().to_string(),
      }
    })
    .collect()
}

pub fn state_label(i: &Issue) -> String {
  match i.state.as_str() {
    "done" => "completada".green().to_string(),
    _ if i.failing() => "falla".red().bold().to_string(),
    "ready" => "disponible".yellow().to_string(),
    _ => "bloqueada".bright_black().to_string(),
  }
}

pub fn icon(i: &Issue) -> String {
  match i.state.as_str() {
    "done" => "✓".green().to_string(),
    _ if i.failing() => "✗".red().bold().to_string(),
    "ready" => "●".yellow().to_string(),
    _ => "○".bright_black().to_string(),
  }
}

/// El resultado del último test de una etapa: qué falló y dónde, o que está sin empezar.
pub fn print_result(r: &TestResult, indent: &str) {
  let sha = &r.sha[..7.min(r.sha.len())];
  if r.ok {
    println!("{indent}{} pasó en {} {}", "✓".green(), sha.cyan(), ago(&r.at).bright_black());
    return;
  }
  let at = r.location.as_ref().map(|w| w.to_string());
  if r.not_started() {
    let start = at.map(|w| format!(" en {}", w.cyan())).unwrap_or_default();
    println!("{indent}{} sin empezar: el test llega al todo!(){start}", "○".bright_black());
    return;
  }
  println!("{indent}{} {} en {} {}", "✗".red().bold(), "el test falló".red().bold(), sha.cyan(), ago(&r.at).bright_black());
  if let Some(m) = &r.message {
    println!("{indent}  {}", m.bold());
  }
  if let Some(w) = at {
    println!("{indent}  {} {}", "en".bright_black(), w.cyan().underline());
  }
}

/// La salida del test con las líneas importantes resaltadas.
pub fn print_log(r: &TestResult) {
  let Some(log) = &r.log else {
    println!("{}", "El run no mandó la salida.".bright_black());
    return;
  };
  for (k, line) in log.lines().enumerate() {
    if r.highlight.contains(&k) {
      println!("{}", line.on_red().white());
    } else {
      println!("{line}");
    }
  }
}

/// Markdown legible en la terminal: títulos, código y listas. No pretende ser un renderer completo.
pub fn print_markdown(md: &str) {
  let mut in_code = false;
  for line in md.lines() {
    if line.trim_start().starts_with("```") {
      in_code = !in_code;
      continue;
    }
    if in_code {
      println!("  {}", line.bright_cyan());
    } else if let Some(h) = line.strip_prefix("## ") {
      println!("\n{}", h.bold().underline());
    } else if let Some(h) = line.strip_prefix("### ") {
      println!("\n{}", h.bold());
    } else if let Some(item) = line.strip_prefix("- [ ] ") {
      println!("  ☐ {}", inline(item));
    } else if let Some(item) = line.strip_prefix("- ") {
      println!("  • {}", inline(item));
    } else {
      println!("{}", inline(line));
    }
  }
}

/// `código` en cian y [texto](link) como texto (link).
fn inline(s: &str) -> String {
  let mut out = String::new();
  let mut code = false;
  for part in s.split('`') {
    if code {
      out.push_str(&part.cyan().to_string());
    } else {
      out.push_str(&links(part).replace("**", ""));
    }
    code = !code;
  }
  out
}

fn links(s: &str) -> String {
  let mut out = String::new();
  let mut rest = s;
  while let Some(a) = rest.find('[') {
    let Some(b) = rest[a..].find("](").map(|b| a + b) else { break };
    let Some(c) = rest[b..].find(')').map(|c| b + c) else { break };
    out.push_str(&rest[..a]);
    out.push_str(&format!("{} {}", &rest[a + 1..b], format!("({})", &rest[b + 2..c]).bright_black()));
    rest = &rest[c + 1..];
  }
  out.push_str(rest);
  out
}
