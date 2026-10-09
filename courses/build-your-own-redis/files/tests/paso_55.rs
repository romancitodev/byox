mod common;
use common::*;

#[test]
fn largo() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["LLEN", "nada"]), Reply::Int(0));
  c.cmd(&["RPUSH", "l", "a", "b", "c"]);
  assert_eq!(c.cmd(&["LLEN", "l"]), Reply::Int(3));
}
