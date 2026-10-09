mod common;
use common::*;

#[test]
fn cuantas_claves_hay() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["DBSIZE"]), Reply::Int(0));
  for k in ["a", "b", "c"] {
    c.cmd(&["SET", k, "x"]);
  }
  c.cmd(&["SET", "a", "otra vez"]);
  assert_eq!(c.cmd(&["DBSIZE"]), Reply::Int(3));
  c.cmd(&["DEL", "b"]);
  assert_eq!(c.cmd(&["DBSIZE"]), Reply::Int(2));
  assert_eq!(c.cmd(&["DBSIZE", "extra"]), Reply::err("ERR wrong number of arguments for 'dbsize' command"));
}
