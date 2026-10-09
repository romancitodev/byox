mod common;
use common::*;

#[test]
fn varios_de_una() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["RPUSH", "l", "a"]), Reply::Int(1));
  assert_eq!(c.cmd(&["RPUSH", "l", "b", "c", "d"]), Reply::Int(4));
}
