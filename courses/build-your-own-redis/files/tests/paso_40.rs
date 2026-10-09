use miredis::glob::glob_match;

fn m(p: &str, t: &str) -> bool {
  glob_match(p.as_bytes(), t.as_bytes())
}

// Los casos de h?llo, h*llo, h[ae]llo, h[^e]llo y h[a-b]llo son los de la documentación de KEYS,
// verificados contra redis-server con KEYS.

#[test]
fn literal() {
  assert!(m("hola", "hola"));
  assert!(!m("hola", "holas"));
  assert!(!m("hola", "hol"));
  assert!(m("", ""));
}

#[test]
fn signo_de_pregunta() {
  assert!(m("h?llo", "hello"));
  assert!(m("h?llo", "hallo"));
  assert!(!m("h?llo", "hllo"));
  assert!(!m("h?llo", "heello"));
}

#[test]
fn asterisco() {
  assert!(m("h*llo", "hllo"));
  assert!(m("h*llo", "heeeello"));
  // Como stringmatchlen en util.c: con el texto vacío el bucle no arranca y no hay match.
  assert!(!m("*", ""));
  assert!(m("*", "cualquier cosa"));
  assert!(m("a*b*c", "aXXbYYc"));
  assert!(!m("a*b*c", "aXXbYY"));
  assert!(m("**", "x"));
}

#[test]
fn corchetes() {
  assert!(m("h[ae]llo", "hello"));
  assert!(m("h[ae]llo", "hallo"));
  assert!(!m("h[ae]llo", "hillo"));
  assert!(m("h[^e]llo", "hallo"));
  assert!(!m("h[^e]llo", "hello"));
  assert!(m("h[a-b]llo", "hallo"));
  assert!(m("h[a-b]llo", "hbllo"));
  assert!(!m("h[a-b]llo", "hcllo"));
  // Un rango al revés vale lo mismo que al derecho.
  assert!(m("h[b-a]llo", "hallo"));
}

#[test]
fn escapes() {
  assert!(m("h\\*llo", "h*llo"));
  assert!(!m("h\\*llo", "hello"));
  assert!(m("que\\?", "que?"));
  assert!(!m("que\\?", "quex"));
  assert!(m("[\\]]", "]"));
}
