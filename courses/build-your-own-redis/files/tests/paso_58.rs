mod common;
use common::*;

#[test]
fn varios_de_una() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a", "b", "c", "d"]);
  assert_eq!(c.cmd(&["LPOP", "l", "2"]), Reply::strs(&["a", "b"]));
  assert_eq!(c.cmd(&["RPOP", "l", "5"]), Reply::strs(&["d", "c"]), "si pedís más de los que hay, vienen todos");
}

#[test]
fn cero_y_clave_inexistente() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a"]);
  assert_eq!(c.cmd(&["RPOP", "l", "0"]), Reply::strs(&[]));
  // Con cantidad, una clave que no existe da el array nulo, no un array vacío.
  assert_eq!(c.cmd(&["LPOP", "nada", "0"]), Reply::NilArray);
  assert_eq!(c.cmd(&["RPOP", "nada", "3"]), Reply::NilArray);
}

#[test]
fn cantidades_invalidas() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a"]);
  assert_eq!(c.cmd(&["LPOP", "l", "-1"]), Reply::err("ERR value is out of range, must be positive"));
  assert_eq!(c.cmd(&["RPOP", "l", "abc"]), Reply::err("ERR value is out of range, must be positive"));
}
