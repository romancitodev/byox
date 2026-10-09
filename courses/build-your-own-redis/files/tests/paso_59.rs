mod common;
use common::*;

#[test]
fn una_lista_vacia_no_existe() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b"]);
  c.cmd(&["LPOP", "l"]);
  assert_eq!(c.cmd(&["EXISTS", "l"]), Reply::Int(1));
  c.cmd(&["RPOP", "l"]);
  assert_eq!(c.cmd(&["EXISTS", "l"]), Reply::Int(0));
  c.cmd(&["RPUSH", "m", "a", "b", "c"]);
  c.cmd(&["LPOP", "m", "10"]);
  assert_eq!(c.cmd(&["EXISTS", "m"]), Reply::Int(0));
}
