mod common;
use common::*;

#[test]
fn hay_algo_para_sacar() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "cola", "a", "b"]);
  // Responde la clave y el elemento, para saber de qué lista salió.
  assert_eq!(c.cmd(&["BLPOP", "cola", "0"]), Reply::strs(&["cola", "a"]));
  assert_eq!(c.cmd(&["LRANGE", "cola", "0", "-1"]), Reply::strs(&["b"]));
}

#[test]
fn la_primera_no_vacia_en_orden() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "b", "1"]);
  c.cmd(&["RPUSH", "c", "2"]);
  assert_eq!(c.cmd(&["BLPOP", "a", "c", "b", "0"]), Reply::strs(&["c", "2"]));
}

#[test]
fn sobre_algo_que_no_es_lista() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "s", "v"]);
  let wrongtype = Reply::err("WRONGTYPE Operation against a key holding the wrong kind of value");
  assert_eq!(c.cmd(&["BLPOP", "s", "1"]), wrongtype);
  assert_eq!(c.cmd(&["BLPOP", "nada", "s", "1"]), wrongtype);
}
