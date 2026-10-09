mod common;
use common::*;

#[test]
fn agrega_al_principio() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b"]);
  assert_eq!(c.cmd(&["LPUSH", "l", "x", "y", "z"]), Reply::Int(5));
  // Cada uno se agrega adelante del anterior: quedan al revés.
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["z", "y", "x", "a", "b"]));
  assert_eq!(c.cmd(&["LPUSH", "nueva", "solo"]), Reply::Int(1));
}
