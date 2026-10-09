mod common;
use common::*;

#[test]
fn un_tiempo_en_el_pasado_borra() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "p", "v"]);
  assert_eq!(c.cmd(&["EXPIRE", "p", "-1"]), Reply::Int(1));
  assert_eq!(c.cmd(&["EXISTS", "p"]), Reply::Int(0));
  c.cmd(&["SET", "q", "v"]);
  assert_eq!(c.cmd(&["PEXPIRE", "q", "0"]), Reply::Int(1));
  assert_eq!(c.cmd(&["EXISTS", "q"]), Reply::Int(0));
}
