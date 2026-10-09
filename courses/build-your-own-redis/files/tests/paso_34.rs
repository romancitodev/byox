mod common;
use common::*;

#[test]
fn agrega_al_final() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["APPEND", "log", "abc"]), Reply::Int(3));
  assert_eq!(c.cmd(&["APPEND", "log", "xyz"]), Reply::Int(6));
  assert_eq!(c.cmd(&["GET", "log"]), Reply::bulk("abcxyz"));
}
