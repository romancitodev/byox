mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn las_vencidas_se_borran_solas() {
  let server = start();
  let mut c = connect(&server);
  for i in 0..500 {
    c.cmd(&["SET", &format!("efimera:{i}"), "x", "PX", "50"]);
  }
  c.cmd(&["SET", "viva", "x"]);
  assert_eq!(c.cmd(&["DBSIZE"]), Reply::Int(501));
  // Nadie lee esas claves: si desaparecen es porque el servidor las borró por su cuenta.
  sleep(Duration::from_millis(1500));
  assert_eq!(c.cmd(&["DBSIZE"]), Reply::Int(1));
}
