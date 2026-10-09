//! Dónde falló y por qué, a partir de la salida de un test. Es la misma lógica que usa
//! el MCP para la web (mcp/src/results.ts), para que `byox test` diga lo mismo localmente.

pub struct Diagnosis {
  /// "compile", "panic", "assert", "python", "todo" o "unknown"
  pub kind: &'static str,
  pub message: String,
  pub location: Option<String>,
}

/// Saca los códigos ANSI (colores de cargo) para poder leer la salida.
pub fn strip_ansi(s: &str) -> String {
  let mut out = String::with_capacity(s.len());
  let mut chars = s.chars().peekable();
  while let Some(c) = chars.next() {
    if c == '\u{1b}' && chars.peek() == Some(&'[') {
      chars.next();
      for c in chars.by_ref() {
        if c.is_ascii_alphabetic() {
          break;
        }
      }
    } else {
      out.push(c);
    }
  }
  out
}

pub fn diagnose(log: &str) -> Diagnosis {
  let lines: Vec<&str> = log.lines().collect();

  // Rust, error de compilación: `error[E0425]: ...` y más abajo `--> src/scan.rs:17:5`.
  if let Some(k) = lines.iter().position(|l| {
    (l.starts_with("error[E") || l.starts_with("error: ")) && !l.starts_with("error: test failed") && !l.starts_with("error: could not compile")
  }) {
    let location = lines[k..].iter().find_map(|l| l.trim_start().strip_prefix("--> ")).map(|s| s.trim().to_string());
    let message = lines[k].split_once("]: ").map(|(_, m)| m).unwrap_or(lines[k].trim_start_matches("error: "));
    return Diagnosis { kind: "compile", message: message.to_string(), location };
  }

  // Rust, pánico en un test: `thread 'x' panicked at tests/paso_07.rs:18:3:` + el mensaje debajo.
  if let Some(k) = lines.iter().position(|l| l.contains("panicked at ")) {
    let at = lines[k].split("panicked at ").nth(1).unwrap_or("").trim_end_matches(':').to_string();
    let rest: Vec<&str> = lines[k + 1..]
      .iter()
      .take_while(|l| !l.trim().is_empty() && !l.starts_with("note: "))
      .take(4)
      .map(|l| l.trim())
      .collect();
    let text = rest.join(" ");
    if text.contains("not yet implemented") || text.contains("not implemented") {
      return Diagnosis { kind: "todo", message: "Todavía está el todo!() en el código".into(), location: Some(at) };
    }
    let kind = if text.contains("assertion") { "assert" } else { "panic" };
    return Diagnosis { kind, message: if text.is_empty() { lines[k].to_string() } else { text }, location: Some(at) };
  }

  // Python: el último `File "...", line N` del traceback y la excepción al final.
  if let Some(k) = lines.iter().rposition(|l| l.trim_start().starts_with("File \"")) {
    let l = lines[k].trim_start();
    let path = l.split('"').nth(1).unwrap_or("").trim_start_matches("/work/").to_string();
    let line = l.split("line ").nth(1).and_then(|s| s.split(',').next()).unwrap_or("?");
    let exc = lines[k..].iter().find(|l| {
      let w = l.split(':').next().unwrap_or("");
      !l.starts_with(' ') && (w.ends_with("Error") || w.ends_with("Exception"))
    });
    let message = exc.map(|e| e.to_string()).unwrap_or_else(|| l.to_string());
    let kind = if message.starts_with("NotImplementedError") { "todo" } else { "python" };
    return Diagnosis { kind, message, location: Some(format!("{path}:{line}")) };
  }

  let msg = lines
    .iter()
    .find(|l| {
      let low = l.to_lowercase();
      ["error", "fail", "assert", "exception", "not found"].iter().any(|w| low.contains(w))
    })
    .map(|l| l.trim().to_string())
    .unwrap_or_else(|| "El test terminó con error.".into());
  Diagnosis { kind: "unknown", message: msg, location: None }
}
