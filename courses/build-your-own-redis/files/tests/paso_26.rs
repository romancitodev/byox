mod common;
use common::*;

#[test]
fn clave_que_no_existe() {
  let server = start();
  let mut c = connect(&server);
  c.send(&encode_command(&[b"GET", b"nada"]));
  assert_eq!(c.read_raw(), b"$-1\r\n");
}

#[test]
fn aridad_de_get_y_set() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["GET"]), Reply::err("ERR wrong number of arguments for 'get' command"));
  assert_eq!(c.cmd(&["SET", "k"]), Reply::err("ERR wrong number of arguments for 'set' command"));
}
