//! Lo que comparten los tests: levantar tu servidor y hablarle como un cliente de Redis.
//!
//! Tiene su propio lector de RESP a propósito: así un error en tu `resp.rs` no rompe la
//! forma en que los tests leen lo que responde tu servidor.
#![allow(dead_code)]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

pub use miredis::{Config, Server};

/// Cuánto espera un test una respuesta antes de darse por vencido.
pub const TIMEOUT: Duration = Duration::from_secs(3);

/// Una respuesta de Redis, leída por los tests.
#[derive(Clone, Debug, PartialEq)]
pub enum Reply {
  Simple(String),
  Error(String),
  Int(i64),
  Bulk(Vec<u8>),
  Nil,
  Array(Vec<Reply>),
  NilArray,
}

impl Reply {
  pub fn ok() -> Reply {
    Reply::Simple("OK".into())
  }
  pub fn simple(s: &str) -> Reply {
    Reply::Simple(s.into())
  }
  pub fn err(s: &str) -> Reply {
    Reply::Error(s.into())
  }
  pub fn bulk(s: &str) -> Reply {
    Reply::Bulk(s.as_bytes().to_vec())
  }
  /// Un array de bulk strings.
  pub fn strs(items: &[&str]) -> Reply {
    Reply::Array(items.iter().map(|s| Reply::bulk(s)).collect())
  }
  /// Los elementos de un array de bulk strings, como texto. Falla si no lo es.
  pub fn texts(&self) -> Vec<String> {
    match self {
      Reply::Array(items) => items
        .iter()
        .map(|r| match r {
          Reply::Bulk(b) => String::from_utf8_lossy(b).into_owned(),
          other => panic!("esperaba un array de bulk strings, uno de los elementos es {other:?}"),
        })
        .collect(),
      other => panic!("esperaba un array, llegó {other:?}"),
    }
  }
}

/// Levanta tu servidor en un puerto libre, con la configuración por defecto
/// y un directorio de trabajo propio para que los tests no se pisen.
pub fn start() -> Server {
  start_with(Config { dir: temp_dir(), ..Config::default() })
}

pub fn start_with(config: Config) -> Server {
  Server::start("127.0.0.1:0", config).expect("Server::start devolvió un error")
}

/// Un directorio vacío y único para este test.
pub fn temp_dir() -> PathBuf {
  static N: AtomicUsize = AtomicUsize::new(0);
  let dir = std::env::temp_dir().join(format!(
    "miredis-test-{}-{}",
    std::process::id(),
    N.fetch_add(1, Ordering::SeqCst)
  ));
  let _ = std::fs::remove_dir_all(&dir);
  std::fs::create_dir_all(&dir).unwrap();
  dir
}

/// Una conexión a tu servidor.
pub struct Client {
  stream: TcpStream,
  buf: Vec<u8>,
}

pub fn connect(server: &Server) -> Client {
  let stream = TcpStream::connect(server.addr()).expect("no me pude conectar al servidor");
  stream.set_nodelay(true).unwrap();
  Client { stream, buf: Vec::new() }
}

/// Un comando como lo manda redis-cli: un array de bulk strings.
pub fn encode_command(args: &[&[u8]]) -> Vec<u8> {
  let mut out = format!("*{}\r\n", args.len()).into_bytes();
  for a in args {
    out.extend_from_slice(format!("${}\r\n", a.len()).as_bytes());
    out.extend_from_slice(a);
    out.extend_from_slice(b"\r\n");
  }
  out
}

impl Client {
  /// Manda un comando y devuelve la respuesta.
  pub fn cmd(&mut self, args: &[&str]) -> Reply {
    let args: Vec<&[u8]> = args.iter().map(|a| a.as_bytes()).collect();
    self.cmd_bytes(&args)
  }

  pub fn cmd_bytes(&mut self, args: &[&[u8]]) -> Reply {
    self.send(&encode_command(args));
    self.read()
  }

  /// Manda bytes tal cual, sin esperar respuesta.
  pub fn send(&mut self, bytes: &[u8]) {
    self.stream.write_all(bytes).expect("no pude escribir en la conexión");
  }

  /// La próxima respuesta. Falla si no llega en `TIMEOUT`.
  pub fn read(&mut self) -> Reply {
    let raw = self.read_raw();
    parse(&raw).expect("respuesta incompleta").0
  }

  /// Los bytes exactos de la próxima respuesta.
  pub fn read_raw(&mut self) -> Vec<u8> {
    match self.read_raw_within(TIMEOUT) {
      Some(raw) => raw,
      None => panic!(
        "el servidor no respondió en {:?}. Bytes recibidos hasta ahora: {:?}",
        TIMEOUT,
        String::from_utf8_lossy(&self.buf)
      ),
    }
  }

  /// La próxima respuesta si llega antes de `wait`; si no, `None`.
  pub fn try_read(&mut self, wait: Duration) -> Option<Reply> {
    self.read_raw_within(wait).map(|raw| parse(&raw).unwrap().0)
  }

  fn read_raw_within(&mut self, wait: Duration) -> Option<Vec<u8>> {
    let deadline = Instant::now() + wait;
    loop {
      if let Some((_, n)) = parse(&self.buf) {
        return Some(self.buf.drain(..n).collect());
      }
      let left = deadline.saturating_duration_since(Instant::now());
      if left.is_zero() {
        return None;
      }
      self.stream.set_read_timeout(Some(left)).unwrap();
      let mut chunk = [0u8; 4096];
      match self.stream.read(&mut chunk) {
        Ok(0) => panic!("el servidor cerró la conexión"),
        Ok(n) => self.buf.extend_from_slice(&chunk[..n]),
        Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => return None,
        Err(e) => panic!("error leyendo del servidor: {e}"),
      }
    }
  }

  /// Si el servidor cerró la conexión (lee hasta `wait`).
  pub fn is_closed(&mut self, wait: Duration) -> bool {
    self.stream.set_read_timeout(Some(wait)).unwrap();
    let mut chunk = [0u8; 64];
    match self.stream.read(&mut chunk) {
      Ok(0) => true,
      Ok(_) => false,
      // Un timeout no es un cierre; un reset sí.
      Err(e) => !matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut),
    }
  }
}

/// Lector de RESP2 de los tests. Devuelve la respuesta y cuántos bytes ocupó.
fn parse(buf: &[u8]) -> Option<(Reply, usize)> {
  let line_end = buf.windows(2).position(|w| w == b"\r\n")?;
  let line = std::str::from_utf8(&buf[1..line_end]).ok()?;
  let after = line_end + 2;
  match *buf.first()? {
    b'+' => Some((Reply::Simple(line.into()), after)),
    b'-' => Some((Reply::Error(line.into()), after)),
    b':' => Some((Reply::Int(line.parse().ok()?), after)),
    b'$' => {
      let len: i64 = line.parse().ok()?;
      if len < 0 {
        return Some((Reply::Nil, after));
      }
      let end = after + len as usize;
      if buf.len() < end + 2 {
        return None;
      }
      Some((Reply::Bulk(buf[after..end].to_vec()), end + 2))
    }
    b'*' => {
      let len: i64 = line.parse().ok()?;
      if len < 0 {
        return Some((Reply::NilArray, after));
      }
      let mut items = Vec::new();
      let mut pos = after;
      for _ in 0..len {
        let (item, n) = parse(&buf[pos..])?;
        items.push(item);
        pos += n;
      }
      Some((Reply::Array(items), pos))
    }
    other => panic!("el servidor respondió algo que no es RESP: empieza con {:?}", other as char),
  }
}
