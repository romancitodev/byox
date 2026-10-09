mod common;
use common::*;

#[test]
fn claves_y_valores_binarios() {
  let server = start();
  let mut c = connect(&server);
  let clave: &[u8] = b"\x00clave\r\n";
  let valor: &[u8] = b"valor\r\ncon\x00bytes\xff";
  assert_eq!(c.cmd_bytes(&[b"SET", clave, valor]), Reply::ok());
  assert_eq!(c.cmd_bytes(&[b"GET", clave]), Reply::Bulk(valor.to_vec()));
}

#[test]
fn valor_vacio() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "vacia", ""]);
  // Una clave con un string vacío existe: no es lo mismo que nil.
  assert_eq!(c.cmd(&["GET", "vacia"]), Reply::Bulk(Vec::new()));
}
