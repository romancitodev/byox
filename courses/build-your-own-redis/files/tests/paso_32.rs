mod common;
use common::*;

#[test]
fn incrby_y_decrby() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "n", "11"]);
  assert_eq!(c.cmd(&["INCRBY", "n", "-3"]), Reply::Int(8));
  assert_eq!(c.cmd(&["DECRBY", "n", "2"]), Reply::Int(6));
  assert_eq!(c.cmd(&["INCRBY", "nueva", "100"]), Reply::Int(100));
}
