mod common;
use common::*;

#[test]
fn indices_negativos() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c", "d", "e"]);
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["a", "b", "c", "d", "e"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "-3", "-1"]), Reply::strs(&["c", "d", "e"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "-1", "-1"]), Reply::strs(&["e"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "1", "-2"]), Reply::strs(&["b", "c", "d"]));
}

#[test]
fn negativos_fuera_de_rango() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c"]);
  assert_eq!(c.cmd(&["LRANGE", "l", "-100", "100"]), Reply::strs(&["a", "b", "c"]));
  assert_eq!(c.cmd(&["LRANGE", "l", "-100", "-50"]), Reply::strs(&[]));
}
