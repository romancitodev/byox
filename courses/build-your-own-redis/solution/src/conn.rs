//! Una conexión con un cliente: leer comandos, ejecutarlos y responder.

use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::commands::{self, arity_ok, wrong_args};
use crate::db::now_ms;
use crate::resp::{self, Value};
use crate::server::Shared;

pub fn handle(stream: TcpStream, shared: Arc<Shared>) -> io::Result<()> {
  stream.set_nodelay(true)?;
  let mut reader = stream.try_clone()?;
  let mut conn = Conn { shared, out: stream };
  let mut buf = Vec::new();
  let mut chunk = [0u8; 16 * 1024];
  loop {
    // Puede haber varios comandos en lo que llegó (pipelining) o medio comando.
    loop {
      match next_command(&buf) {
        Ok(Some((args, used))) => {
          buf.drain(..used);
          if args.is_empty() {
            continue;
          }
          let reply = conn.dispatch(&args);
          conn.out.write_all(&resp::encode(&reply))?;
        }
        Ok(None) => break,
        Err(msg) => {
          // Como Redis: un error de protocolo se responde y se cierra la conexión.
          conn.out.write_all(&resp::encode(&Value::err(format!("ERR Protocol error: {msg}"))))?;
          return Ok(());
        }
      }
    }
    let n = reader.read(&mut chunk)?;
    if n == 0 {
      return Ok(());
    }
    buf.extend_from_slice(&chunk[..n]);
  }
}

struct Conn {
  shared: Arc<Shared>,
  out: TcpStream,
}

impl Conn {
  fn dispatch(&mut self, args: &[Vec<u8>]) -> Value {
    let name = String::from_utf8_lossy(&args[0]).to_lowercase();
    let Some(spec) = commands::spec(&name) else { return unknown_command(args) };
    if !arity_ok(&spec, args.len()) {
      return wrong_args(&name);
    }
    match name.as_str() {
      "ping" => match args.len() {
        1 => Value::Simple("PONG".into()),
        2 => Value::bulk(args[1].clone()),
        _ => wrong_args("ping"),
      },
      "echo" => Value::bulk(args[1].clone()),
      "blpop" => self.blpop(args),
      _ => {
        let reply = {
          let mut db = self.shared.db.lock().unwrap();
          commands::run(&mut db, &name, args, now_ms())
        };
        // Una escritura puede destrabar a un cliente que espera en BLPOP.
        if spec.write {
          self.shared.changed.notify_all();
        }
        reply
      }
    }
  }

  /// BLPOP key [key ...] timeout. Si no hay nada, el cliente queda en la fila de cada clave
  /// y solo saca un elemento cuando es el primero de la fila: el orden es FIFO, como en Redis.
  fn blpop(&mut self, args: &[Vec<u8>]) -> Value {
    let keys = &args[1..args.len() - 1];
    let deadline = match parse_timeout(&args[args.len() - 1]) {
      Ok(t) => t.map(|d| Instant::now() + d),
      Err(e) => return e,
    };
    let mut db = self.shared.db.lock().unwrap();
    match commands::pop_first(&mut db, keys, now_ms()) {
      Err(e) => return e,
      Ok(Some((k, v))) => return Value::Array(vec![Value::Bulk(k), Value::Bulk(v)]),
      Ok(None) => {}
    }

    let id = db.next_waiter;
    db.next_waiter += 1;
    for k in keys {
      db.blocked.entry(k.clone()).or_default().push_back(id);
    }
    let reply = loop {
      let now = now_ms();
      let mut ready = None;
      for k in keys {
        let first = db.blocked.get(k).and_then(|q| q.front()).copied();
        if first == Some(id) && commands::has_items(&mut db, k, now) {
          ready = Some(k.clone());
          break;
        }
      }
      if let Some(k) = ready {
        if let Ok(Some((k, v))) = commands::pop_first(&mut db, &[k], now) {
          break Value::Array(vec![Value::Bulk(k), Value::Bulk(v)]);
        }
      }
      db = match deadline {
        None => self.shared.changed.wait(db).unwrap(),
        Some(d) => {
          let left = d.saturating_duration_since(Instant::now());
          if left.is_zero() {
            break Value::NullArray;
          }
          self.shared.changed.wait_timeout(db, left).unwrap().0
        }
      };
    };
    for k in keys {
      if let Some(q) = db.blocked.get_mut(k) {
        q.retain(|&w| w != id);
        if q.is_empty() {
          db.blocked.remove(k);
        }
      }
    }
    drop(db);
    // El que sigue en la fila puede tener su elemento esperando.
    self.shared.changed.notify_all();
    reply
  }
}

/// El timeout de BLPOP: segundos con decimales; 0 es esperar para siempre (`None`).
fn parse_timeout(arg: &[u8]) -> Result<Option<Duration>, Value> {
  let t: f64 = std::str::from_utf8(arg)
    .ok()
    .and_then(|s| s.parse().ok())
    .filter(|t: &f64| t.is_finite())
    .ok_or_else(|| Value::err("ERR timeout is not a float or out of range"))?;
  if t < 0.0 {
    return Err(Value::err("ERR timeout is negative"));
  }
  Ok(if t == 0.0 { None } else { Some(Duration::from_secs_f64(t)) })
}

/// `ERR unknown command 'FOO', with args beginning with: 'a' 'b' `, como en server.c.
fn unknown_command(args: &[Vec<u8>]) -> Value {
  let mut msg = format!("ERR unknown command '{}'", String::from_utf8_lossy(&args[0]));
  if args.len() > 1 {
    let mut list = String::new();
    for a in &args[1..] {
      if list.len() >= 128 {
        break;
      }
      list.push_str(&format!("'{}' ", String::from_utf8_lossy(a)));
    }
    msg.push_str(&format!(", with args beginning with: {list}"));
  }
  Value::err(msg)
}

/// El próximo comando del buffer: un array de bulk strings o una línea inline (`PING\r\n`).
pub fn next_command(buf: &[u8]) -> Result<Option<(Vec<Vec<u8>>, usize)>, String> {
  let Some(&first) = buf.first() else { return Ok(None) };
  if first == b'*' {
    return match resp::parse(buf) {
      Ok(None) => Ok(None),
      Err(e) => Err(e.0),
      Ok(Some((Value::Array(items), used))) => {
        let args = items
          .into_iter()
          .map(|v| match v {
            Value::Bulk(b) => Ok(b),
            other => Err(format!("expected '$', got {other:?}")),
          })
          .collect::<Result<Vec<_>, _>>()?;
        Ok(Some((args, used)))
      }
      Ok(Some((_, used))) => Ok(Some((Vec::new(), used))),
    };
  }
  let Some(nl) = buf.iter().position(|&b| b == b'\n') else { return Ok(None) };
  let line = buf[..nl].strip_suffix(b"\r").unwrap_or(&buf[..nl]);
  let args = split_args(line).ok_or("unbalanced quotes in request")?;
  Ok(Some((args, nl + 1)))
}

/// Parte una línea inline en argumentos con las reglas de `sdssplitargs` (sds.c):
/// espacios separan, "..." admite escapes como \n o \x41, '...' solo admite \'.
pub fn split_args(line: &[u8]) -> Option<Vec<Vec<u8>>> {
  let mut args = Vec::new();
  let mut i = 0;
  loop {
    while i < line.len() && line[i].is_ascii_whitespace() {
      i += 1;
    }
    if i == line.len() {
      return Some(args);
    }
    let mut cur = Vec::new();
    let (mut dq, mut sq) = (false, false);
    loop {
      if dq {
        let c = *line.get(i)?;
        if c == b'\\' && i + 3 < line.len() && line[i + 1] == b'x' && hex(line[i + 2]).is_some() && hex(line[i + 3]).is_some() {
          cur.push(hex(line[i + 2])? * 16 + hex(line[i + 3])?);
          i += 3;
        } else if c == b'\\' && i + 1 < line.len() {
          i += 1;
          cur.push(match line[i] {
            b'n' => b'\n',
            b'r' => b'\r',
            b't' => b'\t',
            b'b' => 8,
            b'a' => 7,
            other => other,
          });
        } else if c == b'"' {
          // La comilla de cierre tiene que ir seguida de un espacio o del final.
          if i + 1 < line.len() && !line[i + 1].is_ascii_whitespace() {
            return None;
          }
          dq = false;
          i += 1;
          break;
        } else {
          cur.push(c);
        }
      } else if sq {
        let c = *line.get(i)?;
        if c == b'\\' && i + 1 < line.len() && line[i + 1] == b'\'' {
          cur.push(b'\'');
          i += 1;
        } else if c == b'\'' {
          if i + 1 < line.len() && !line[i + 1].is_ascii_whitespace() {
            return None;
          }
          sq = false;
          i += 1;
          break;
        } else {
          cur.push(c);
        }
      } else {
        match line.get(i) {
          None => break,
          Some(c) if c.is_ascii_whitespace() => break,
          Some(b'"') => dq = true,
          Some(b'\'') => sq = true,
          Some(&c) => cur.push(c),
        }
      }
      i += 1;
    }
    if dq || sq {
      return None;
    }
    args.push(cur);
  }
}

fn hex(c: u8) -> Option<u8> {
  (c as char).to_digit(16).map(|d| d as u8)
}
