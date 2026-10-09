mod common;
use common::*;

#[test]
fn recorta() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "z", "y", "x", "a", "b"]);
  assert_eq!(c.cmd(&["LTRIM", "l", "1", "3"]), Reply::ok());
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["y", "x", "a"]));
  assert_eq!(c.cmd(&["LTRIM", "l", "0", "-1"]), Reply::ok());
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["y", "x", "a"]));
  assert_eq!(c.cmd(&["LTRIM", "l", "-2", "-1"]), Reply::ok());
  assert_eq!(c.cmd(&["LRANGE", "l", "0", "-1"]), Reply::strs(&["x", "a"]));
}

#[test]
fn un_rango_vacio_borra_la_lista() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b"]);
  assert_eq!(c.cmd(&["LTRIM", "l", "5", "10"]), Reply::ok());
  assert_eq!(c.cmd(&["EXISTS", "l"]), Reply::Int(0));
  assert_eq!(c.cmd(&["LTRIM", "nada", "0", "1"]), Reply::ok());
  assert_eq!(c.cmd(&["LTRIM", "l", "abc", "1"]), Reply::err("ERR value is not an integer or out of range"));
}
