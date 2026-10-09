mod common;
use common::*;

fn keys(c: &mut Client, pattern: &str) -> Vec<String> {
  // KEYS no promete ningún orden.
  let mut k = c.cmd(&["KEYS", pattern]).texts();
  k.sort();
  k
}

#[test]
fn keys_con_patrones() {
  let server = start();
  let mut c = connect(&server);
  for k in ["hola", "hallo", "hxllo", "hllo", "heeeello", "h*llo"] {
    c.cmd(&["SET", k, "1"]);
  }
  assert_eq!(keys(&mut c, "h?llo"), ["h*llo", "hallo", "hxllo"]);
  assert_eq!(keys(&mut c, "h*llo"), ["h*llo", "hallo", "heeeello", "hllo", "hxllo"]);
  assert_eq!(keys(&mut c, "h[ae]llo"), ["hallo"]);
  assert_eq!(keys(&mut c, "h\\*llo"), ["h*llo"]);
  assert_eq!(keys(&mut c, "*").len(), 6);
  assert!(keys(&mut c, "nada*").is_empty());
}

#[test]
fn asterisco_solo_trae_todo() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "", "clave vacía"]);
  c.cmd(&["SET", "a", "1"]);
  // `KEYS *` no usa el glob: devuelve todas las claves, también la vacía (db.c, keysCommand).
  assert_eq!(keys(&mut c, "*"), ["", "a"]);
  assert_eq!(keys(&mut c, "**"), ["a"]);
}
