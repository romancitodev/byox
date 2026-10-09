mod common;
use common::*;

#[test]
fn opciones_invalidas() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v"]);
  assert_eq!(c.cmd(&["SET", "k", "v5", "NX", "XX"]), Reply::err("ERR syntax error"));
  assert_eq!(c.cmd(&["SET", "k", "v", "FOO"]), Reply::err("ERR syntax error"));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v"));
}
