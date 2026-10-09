mod common;
use common::*;

#[test]
fn cuenta_las_que_existen() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v"]);
  assert_eq!(c.cmd(&["EXISTS", "k"]), Reply::Int(1));
  assert_eq!(c.cmd(&["EXISTS", "nada"]), Reply::Int(0));
  // Las repetidas cuentan cada vez.
  assert_eq!(c.cmd(&["EXISTS", "k", "k", "nada"]), Reply::Int(2));
}
