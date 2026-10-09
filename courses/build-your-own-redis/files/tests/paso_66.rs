mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn el_primero_en_llegar_es_el_primero_en_recibir() {
  let server = start();
  let mut a = connect(&server);
  let mut b = connect(&server);
  let mut otro = connect(&server);
  a.send(&encode_command(&[b"BLPOP", b"cola", b"5"]));
  sleep(Duration::from_millis(200));
  b.send(&encode_command(&[b"BLPOP", b"cola", b"5"]));
  sleep(Duration::from_millis(200));
  otro.cmd(&["RPUSH", "cola", "uno"]);
  assert_eq!(a.read(), Reply::strs(&["cola", "uno"]), "A se bloqueó primero");
  assert_eq!(b.try_read(Duration::from_millis(300)), None, "B sigue esperando");
  otro.cmd(&["RPUSH", "cola", "dos"]);
  assert_eq!(b.read(), Reply::strs(&["cola", "dos"]));
}

#[test]
fn dos_elementos_dos_clientes() {
  let server = start();
  let mut a = connect(&server);
  let mut b = connect(&server);
  let mut otro = connect(&server);
  a.send(&encode_command(&[b"BLPOP", b"q", b"5"]));
  sleep(Duration::from_millis(200));
  b.send(&encode_command(&[b"BLPOP", b"q", b"5"]));
  sleep(Duration::from_millis(200));
  otro.cmd(&["RPUSH", "q", "x", "y"]);
  assert_eq!(a.read(), Reply::strs(&["q", "x"]));
  assert_eq!(b.read(), Reply::strs(&["q", "y"]));
  assert_eq!(otro.cmd(&["LLEN", "q"]), Reply::Int(0));
}

#[test]
fn diez_clientes_en_fila() {
  let server = start();
  let mut otro = connect(&server);
  let mut clientes: Vec<Client> = (0..10).map(|_| connect(&server)).collect();
  for c in clientes.iter_mut() {
    c.send(&encode_command(&[b"BLPOP", b"fila", b"5"]));
    sleep(Duration::from_millis(50));
  }
  for i in 0..10 {
    otro.cmd(&["RPUSH", "fila", &i.to_string()]);
  }
  for (i, c) in clientes.iter_mut().enumerate() {
    assert_eq!(c.read(), Reply::strs(&["fila", &i.to_string()]), "el cliente {i} tenía que recibir el elemento {i}");
  }
}
