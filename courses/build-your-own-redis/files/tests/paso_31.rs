mod common;
use common::*;

#[test]
fn incr_y_decr() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["INCR", "visitas"]), Reply::Int(1));
  c.cmd(&["SET", "n", "10"]);
  assert_eq!(c.cmd(&["INCR", "n"]), Reply::Int(11));
  assert_eq!(c.cmd(&["DECR", "n"]), Reply::Int(10));
  assert_eq!(c.cmd(&["DECR", "nueva"]), Reply::Int(-1));
  // El valor sigue siendo un string.
  assert_eq!(c.cmd(&["GET", "n"]), Reply::bulk("10"));
}
