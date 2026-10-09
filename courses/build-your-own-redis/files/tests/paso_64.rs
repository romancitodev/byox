mod common;
use common::*;
use std::thread::sleep;
use std::time::{Duration, Instant};

#[test]
fn espera_a_que_llegue_algo() {
  let server = start();
  let mut esperando = connect(&server);
  let mut otro = connect(&server);
  esperando.send(&encode_command(&[b"BLPOP", b"cola", b"5"]));
  assert_eq!(esperando.try_read(Duration::from_millis(300)), None, "no hay nada: tiene que esperar");
  let t = Instant::now();
  assert_eq!(otro.cmd(&["RPUSH", "cola", "x", "y"]), Reply::Int(2));
  assert_eq!(esperando.read(), Reply::strs(&["cola", "x"]));
  assert!(t.elapsed() < Duration::from_millis(500), "tardó {:?} en despertarse", t.elapsed());
  assert_eq!(otro.cmd(&["LRANGE", "cola", "0", "-1"]), Reply::strs(&["y"]));
}

#[test]
fn con_lpush_y_borra_la_lista() {
  let server = start();
  let mut esperando = connect(&server);
  let mut otro = connect(&server);
  esperando.send(&encode_command(&[b"BLPOP", b"solo", b"5"]));
  sleep(Duration::from_millis(200));
  otro.cmd(&["LPUSH", "solo", "x"]);
  assert_eq!(esperando.read(), Reply::strs(&["solo", "x"]));
  assert_eq!(otro.cmd(&["EXISTS", "solo"]), Reply::Int(0));
}

#[test]
fn espera_en_varias_listas() {
  let server = start();
  let mut esperando = connect(&server);
  let mut otro = connect(&server);
  esperando.send(&encode_command(&[b"BLPOP", b"l1", b"l2", b"5"]));
  sleep(Duration::from_millis(200));
  otro.cmd(&["RPUSH", "l2", "z"]);
  assert_eq!(esperando.read(), Reply::strs(&["l2", "z"]));
}

#[test]
fn los_demas_clientes_no_se_traban() {
  let server = start();
  let mut esperando = connect(&server);
  let mut otro = connect(&server);
  esperando.send(&encode_command(&[b"BLPOP", b"nunca", b"5"]));
  sleep(Duration::from_millis(100));
  assert_eq!(otro.cmd(&["SET", "k", "v"]), Reply::ok());
  assert_eq!(otro.cmd(&["GET", "k"]), Reply::bulk("v"));
}
