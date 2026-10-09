mod common;
use common::*;

#[test]
fn la_conexion_sigue_abierta() {
  let server = start();
  let mut c = connect(&server);
  for _ in 0..10 {
    assert_eq!(c.cmd(&["PING"]), Reply::simple("PONG"));
  }
}
