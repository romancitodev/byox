mod common;
use common::*;

#[test]
fn un_elemento_por_indice() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c"]);
  assert_eq!(c.cmd(&["LINDEX", "l", "0"]), Reply::bulk("a"));
  assert_eq!(c.cmd(&["LINDEX", "l", "-1"]), Reply::bulk("c"));
  assert_eq!(c.cmd(&["LINDEX", "l", "100"]), Reply::Nil);
  assert_eq!(c.cmd(&["LINDEX", "l", "-100"]), Reply::Nil);
  assert_eq!(c.cmd(&["LINDEX", "nada", "0"]), Reply::Nil);
  assert_eq!(c.cmd(&["LINDEX", "l", "abc"]), Reply::err("ERR value is not an integer or out of range"));
}
