mod common;
use common::*;

#[test]
fn rangos_positivos() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c", "d"]);
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "3"]), Reply::strs(&["a", "b", "c", "d"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "1", "2"]), Reply::strs(&["b", "c"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "0"]), Reply::strs(&["a"]));
}

#[test]
fn fuera_de_rango() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c"]);
  // El final se recorta al largo; un inicio después del final da vacío.
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "100"]), Reply::strs(&["a", "b", "c"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "5", "10"]), Reply::strs(&[]));
  assert_eq!(c.cmd(&["LRANGE", "l", "2", "1"]), Reply::strs(&[]));
  assert_eq!(c.cmd(&["LRANGE", "nada", "0", "10"]), Reply::strs(&[]));
  assert_eq!(c.cmd(&["LRANGE", "l", "a", "b"]), Reply::err("ERR value is not an integer or out of range"));
}
