mod common;
use common::*;

#[test]
fn quita_el_vencimiento() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "p", "v", "EX", "50"]);
  assert_eq!(c.cmd(&["PERSIST", "p"]), Reply::Int(1));
  assert_eq!(c.cmd(&["TTL", "p"]), Reply::Int(-1));
  assert_eq!(c.cmd(&["PERSIST", "p"]), Reply::Int(0));
  assert_eq!(c.cmd(&["PERSIST", "nada"]), Reply::Int(0));
}
