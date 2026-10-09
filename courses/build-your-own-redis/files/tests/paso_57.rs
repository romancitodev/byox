mod common;
use common::*;

#[test]
fn saca_de_cada_punta() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c"]);
  assert_eq!(c.cmd(&["LPOP", "l"]), Reply::bulk("a"));
  assert_eq!(c.cmd(&["RPOP", "l"]), Reply::bulk("c"));
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["b"]));
}

#[test]
fn sin_la_clave() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["LPOP", "nada"]), Reply::Nil);
  assert_eq!(c.cmd(&["RPOP", "nada"]), Reply::Nil);
}
