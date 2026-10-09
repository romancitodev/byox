//! Los comandos que leen y escriben claves. Las aridades y los mensajes de error son los de
//! Redis (src/commands/*.json y t_string.c, expire.c, db.c), verificados contra redis-server.

use std::collections::VecDeque;

use crate::db::{Data, Db, Item};
use crate::glob::glob_match;
use crate::resp::Value;

/// Lo que hace falta saber de un comando antes de ejecutarlo.
pub struct Spec {
  /// Como en Redis: N exacto si es positivo, al menos -N si es negativo (contando el nombre).
  pub arity: i32,
  /// Si modifica datos: lo que se propaga al AOF y a las réplicas.
  pub write: bool,
}

pub fn spec(name: &str) -> Option<Spec> {
  let (arity, write) = match name {
    "ping" => (-1, false),
    "echo" => (2, false),
    "set" => (-3, true),
    "get" => (2, false),
    "del" => (-2, true),
    "exists" => (-2, false),
    "dbsize" => (1, false),
    "incr" | "decr" => (2, true),
    "incrby" | "decrby" => (3, true),
    "append" => (3, true),
    "strlen" => (2, false),
    "mset" => (-3, true),
    "mget" => (-2, false),
    "keys" => (2, false),
    "expire" | "pexpire" | "expireat" | "pexpireat" => (-3, true),
    "ttl" | "pttl" => (2, false),
    "persist" => (2, true),
    "type" => (2, false),
    "rpush" | "lpush" => (-3, true),
    "lrange" => (4, false),
    "llen" => (2, false),
    "lindex" => (3, false),
    "lpop" | "rpop" => (-2, true),
    "ltrim" => (4, true),
    "blpop" => (-3, true),
    _ => return None,
  };
  Some(Spec { arity, write })
}

pub fn arity_ok(spec: &Spec, argc: usize) -> bool {
  if spec.arity >= 0 { argc == spec.arity as usize } else { argc >= (-spec.arity) as usize }
}

pub fn wrong_args(name: &str) -> Value {
  Value::err(format!("ERR wrong number of arguments for '{name}' command"))
}

fn wrongtype() -> Value {
  Value::err("WRONGTYPE Operation against a key holding the wrong kind of value")
}

fn syntax() -> Value {
  Value::err("ERR syntax error")
}

/// Un entero como los de Redis (`string2ll`): sin espacios ni signo `+`.
pub fn parse_int(arg: &[u8]) -> Option<i64> {
  let s = std::str::from_utf8(arg).ok()?;
  if s.is_empty() || s.starts_with('+') || s.trim() != s {
    return None;
  }
  s.parse().ok()
}

fn int_arg(arg: &[u8]) -> Result<i64, Value> {
  parse_int(arg).ok_or_else(|| Value::err("ERR value is not an integer or out of range"))
}

fn upper(arg: &[u8]) -> String {
  String::from_utf8_lossy(arg).to_ascii_uppercase()
}

/// Ejecuta un comando de datos. `a[0]` es el nombre ya en minúsculas en `name`.
pub fn run(db: &mut Db, name: &str, a: &[Vec<u8>], now: u64) -> Value {
  match name {
    "set" => set(db, a, now),
    "get" => match db.live(&a[1], now) {
      None => Value::NullBulk,
      Some(Item { data: Data::Str(s), .. }) => Value::bulk(s.clone()),
      Some(_) => wrongtype(),
    },
    "del" => {
      let n = a[1..].iter().filter(|k| db.live(k, now).is_some() && db.items.remove(*k).is_some()).count();
      Value::Integer(n as i64)
    }
    "exists" => Value::Integer(a[1..].iter().filter(|k| db.exists(k, now)).count() as i64),
    // Como en Redis, DBSIZE cuenta también las claves vencidas que todavía no se borraron.
    "dbsize" => Value::Integer(db.items.len() as i64),
    "incr" => incr_by(db, &a[1], 1, now),
    "decr" => incr_by(db, &a[1], -1, now),
    "incrby" => match int_arg(&a[2]) {
      Ok(n) => incr_by(db, &a[1], n, now),
      Err(e) => e,
    },
    "decrby" => match int_arg(&a[2]) {
      Ok(n) => match n.checked_neg() {
        Some(n) => incr_by(db, &a[1], n, now),
        None => Value::err("ERR decrement would overflow"),
      },
      Err(e) => e,
    },
    "append" => match db.live(&a[1], now) {
      None => {
        db.items.insert(a[1].clone(), Item::new(Data::Str(a[2].clone())));
        Value::Integer(a[2].len() as i64)
      }
      Some(Item { data: Data::Str(s), .. }) => {
        s.extend_from_slice(&a[2]);
        Value::Integer(s.len() as i64)
      }
      Some(_) => wrongtype(),
    },
    "strlen" => match db.live(&a[1], now) {
      None => Value::Integer(0),
      Some(Item { data: Data::Str(s), .. }) => Value::Integer(s.len() as i64),
      Some(_) => wrongtype(),
    },
    "mset" => {
      if a.len() % 2 == 0 {
        return wrong_args("mset");
      }
      for pair in a[1..].chunks(2) {
        db.items.insert(pair[0].clone(), Item::new(Data::Str(pair[1].clone())));
      }
      Value::ok()
    }
    // MGET devuelve nil también para las claves de otro tipo.
    "mget" => Value::Array(
      a[1..]
        .iter()
        .map(|k| match db.live(k, now) {
          Some(Item { data: Data::Str(s), .. }) => Value::bulk(s.clone()),
          _ => Value::NullBulk,
        })
        .collect(),
    ),
    "keys" => {
      let mut keys = db.live_keys(now);
      // Como keysCommand en db.c: `*` solo no pasa por el glob, así incluye la clave vacía.
      if a[1] != b"*" {
        keys.retain(|k| glob_match(&a[1], k));
      }
      Value::Array(keys.into_iter().map(Value::Bulk).collect())
    }
    "expire" | "pexpire" | "expireat" | "pexpireat" => expire(db, name, a, now),
    "ttl" | "pttl" => match db.live(&a[1], now) {
      None => Value::Integer(-2),
      Some(Item { expires_at: None, .. }) => Value::Integer(-1),
      Some(Item { expires_at: Some(t), .. }) => {
        let ms = t.saturating_sub(now) as i64;
        Value::Integer(if name == "pttl" { ms } else { (ms + 500) / 1000 })
      }
    },
    "persist" => match db.live(&a[1], now) {
      Some(item) if item.expires_at.is_some() => {
        item.expires_at = None;
        Value::Integer(1)
      }
      _ => Value::Integer(0),
    },
    "type" => Value::Simple(db.live(&a[1], now).map_or("none", |i| i.data.type_name()).into()),
    "rpush" | "lpush" => push(db, name == "lpush", a, now),
    "lrange" => lrange(db, a, now),
    "llen" => match list(db, &a[1], now) {
      Ok(Some(l)) => Value::Integer(l.len() as i64),
      Ok(None) => Value::Integer(0),
      Err(e) => e,
    },
    "lindex" => {
      let i = match int_arg(&a[2]) {
        Ok(i) => i,
        Err(e) => return e,
      };
      match list(db, &a[1], now) {
        Ok(Some(l)) => {
          let i = if i < 0 { i + l.len() as i64 } else { i };
          match usize::try_from(i).ok().and_then(|i| l.get(i)) {
            Some(v) => Value::bulk(v.clone()),
            None => Value::NullBulk,
          }
        }
        Ok(None) => Value::NullBulk,
        Err(e) => e,
      }
    }
    "lpop" | "rpop" => pop(db, name == "lpop", a, now),
    "ltrim" => ltrim(db, a, now),
    other => Value::err(format!("ERR comando sin implementar: {other}")),
  }
}

/// La lista guardada en `key`: `Ok(None)` si no existe, `Err(WRONGTYPE)` si es de otro tipo.
fn list<'a>(db: &'a mut Db, key: &[u8], now: u64) -> Result<Option<&'a mut VecDeque<Vec<u8>>>, Value> {
  match db.live(key, now) {
    None => Ok(None),
    Some(Item { data: Data::List(l), .. }) => Ok(Some(l)),
    Some(_) => Err(wrongtype()),
  }
}

/// Como en Redis, una lista que queda vacía deja de existir.
fn drop_if_empty(db: &mut Db, key: &[u8]) {
  if matches!(db.items.get(key), Some(Item { data: Data::List(l), .. }) if l.is_empty()) {
    db.items.remove(key);
  }
}

fn push(db: &mut Db, left: bool, a: &[Vec<u8>], now: u64) -> Value {
  match list(db, &a[1], now) {
    Err(e) => return e,
    Ok(None) => {
      db.items.insert(a[1].clone(), Item::new(Data::List(VecDeque::new())));
    }
    Ok(Some(_)) => {}
  }
  let Some(Item { data: Data::List(l), .. }) = db.items.get_mut(&a[1]) else { unreachable!() };
  for v in &a[2..] {
    if left { l.push_front(v.clone()) } else { l.push_back(v.clone()) }
  }
  Value::Integer(l.len() as i64)
}

/// Normaliza un rango como `lrangeCommand` en t_list.c: índices negativos desde el final,
/// recortados a la lista. `None` si el rango queda vacío.
fn range(start: i64, end: i64, len: usize) -> Option<(usize, usize)> {
  let len = len as i64;
  let mut start = if start < 0 { start + len } else { start };
  let mut end = if end < 0 { end + len } else { end };
  if start < 0 {
    start = 0;
  }
  if start > end || start >= len {
    return None;
  }
  if end >= len {
    end = len - 1;
  }
  Some((start as usize, end as usize))
}

fn lrange(db: &mut Db, a: &[Vec<u8>], now: u64) -> Value {
  let (start, end) = match (int_arg(&a[2]), int_arg(&a[3])) {
    (Ok(s), Ok(e)) => (s, e),
    (Err(e), _) | (_, Err(e)) => return e,
  };
  match list(db, &a[1], now) {
    Ok(Some(l)) => match range(start, end, l.len()) {
      Some((s, e)) => Value::Array(l.range(s..=e).map(|v| Value::bulk(v.clone())).collect()),
      None => Value::Array(vec![]),
    },
    Ok(None) => Value::Array(vec![]),
    Err(e) => e,
  }
}

/// LPOP / RPOP key [count]
fn pop(db: &mut Db, left: bool, a: &[Vec<u8>], now: u64) -> Value {
  if a.len() > 3 {
    return syntax();
  }
  let count = match a.get(2) {
    None => None,
    Some(c) => match parse_int(c) {
      Some(n) if n >= 0 => Some(n as usize),
      _ => return Value::err("ERR value is out of range, must be positive"),
    },
  };
  let l = match list(db, &a[1], now) {
    Ok(Some(l)) => l,
    // Sin la clave: nil, o el array nulo si se pidió una cantidad (aunque sea 0).
    Ok(None) => return if count.is_some() { Value::NullArray } else { Value::NullBulk },
    Err(e) => return e,
  };
  let take = |l: &mut VecDeque<Vec<u8>>| if left { l.pop_front() } else { l.pop_back() };
  let reply = match count {
    None => take(l).map(Value::Bulk).unwrap_or(Value::NullBulk),
    Some(n) => Value::Array((0..n).map_while(|_| take(l)).map(Value::Bulk).collect()),
  };
  drop_if_empty(db, &a[1]);
  reply
}

fn ltrim(db: &mut Db, a: &[Vec<u8>], now: u64) -> Value {
  let (start, end) = match (int_arg(&a[2]), int_arg(&a[3])) {
    (Ok(s), Ok(e)) => (s, e),
    (Err(e), _) | (_, Err(e)) => return e,
  };
  match list(db, &a[1], now) {
    Ok(Some(l)) => {
      match range(start, end, l.len()) {
        Some((s, e)) => {
          l.truncate(e + 1);
          l.drain(..s);
        }
        None => l.clear(),
      }
      drop_if_empty(db, &a[1]);
      Value::ok()
    }
    Ok(None) => Value::ok(),
    Err(e) => e,
  }
}

/// El primer elemento de la primera lista no vacía de `keys`, para BLPOP.
/// `Err` si alguna de las claves existe y no es una lista.
pub fn pop_first(db: &mut Db, keys: &[Vec<u8>], now: u64) -> Result<Option<(Vec<u8>, Vec<u8>)>, Value> {
  for k in keys {
    if let Some(l) = list(db, k, now)? {
      if let Some(v) = l.pop_front() {
        drop_if_empty(db, k);
        return Ok(Some((k.clone(), v)));
      }
    }
  }
  Ok(None)
}

/// Si `key` tiene una lista con elementos (lo que mira un cliente bloqueado en BLPOP).
pub fn has_items(db: &mut Db, key: &[u8], now: u64) -> bool {
  matches!(list(db, key, now), Ok(Some(l)) if !l.is_empty())
}

/// SET key value [NX | XX] [GET] [EX s | PX ms | EXAT s | PXAT ms | KEEPTTL]
fn set(db: &mut Db, a: &[Vec<u8>], now: u64) -> Value {
  let (mut nx, mut xx, mut get, mut keepttl) = (false, false, false, false);
  let mut expire: Option<(String, &[u8])> = None;
  let mut i = 3;
  while i < a.len() {
    let opt = upper(&a[i]);
    match opt.as_str() {
      "NX" if !xx => nx = true,
      "XX" if !nx => xx = true,
      "GET" => get = true,
      "KEEPTTL" if expire.is_none() => keepttl = true,
      "EX" | "PX" | "EXAT" | "PXAT" if expire.is_none() && !keepttl && i + 1 < a.len() => {
        expire = Some((opt, &a[i + 1]));
        i += 1;
      }
      _ => return syntax(),
    }
    i += 1;
  }
  let expires_at = match expire {
    None => None,
    Some((unit, v)) => {
      let n = match int_arg(v) {
        Ok(n) => n,
        Err(e) => return e,
      };
      let at = match unit.as_str() {
        "EX" => n.checked_mul(1000).and_then(|ms| ms.checked_add(now as i64)),
        "PX" => n.checked_add(now as i64),
        "EXAT" => n.checked_mul(1000),
        _ => Some(n),
      };
      match at {
        Some(at) if n > 0 => Some(at as u64),
        _ => return Value::err("ERR invalid expire time in 'set' command"),
      }
    }
  };

  let (exists, old, old_ttl) = match db.live(&a[1], now) {
    None => (false, None, None),
    Some(Item { data: Data::Str(s), expires_at }) => (true, Some(s.clone()), *expires_at),
    Some(_) if get => return wrongtype(),
    Some(item) => (true, None, item.expires_at),
  };
  let old_reply = || old.clone().map(Value::Bulk).unwrap_or(Value::NullBulk);
  if (nx && exists) || (xx && !exists) {
    return if get { old_reply() } else { Value::NullBulk };
  }
  let ttl = if keepttl { old_ttl } else { expires_at };
  db.items.insert(a[1].clone(), Item { data: Data::Str(a[2].clone()), expires_at: ttl });
  if get { old_reply() } else { Value::ok() }
}

fn incr_by(db: &mut Db, key: &[u8], delta: i64, now: u64) -> Value {
  let current = match db.live(key, now) {
    None => 0,
    Some(Item { data: Data::Str(s), .. }) => match parse_int(s) {
      Some(n) => n,
      None => return Value::err("ERR value is not an integer or out of range"),
    },
    Some(_) => return wrongtype(),
  };
  let Some(next) = current.checked_add(delta) else {
    return Value::err("ERR increment or decrement would overflow");
  };
  // INCR conserva el vencimiento: modifica el valor, no reemplaza la clave.
  match db.live(key, now) {
    Some(item) => item.data = Data::Str(next.to_string().into_bytes()),
    None => {
      db.items.insert(key.to_vec(), Item::new(Data::Str(next.to_string().into_bytes())));
    }
  }
  Value::Integer(next)
}

/// EXPIRE / PEXPIRE / EXPIREAT / PEXPIREAT key tiempo [NX | XX | GT | LT]
fn expire(db: &mut Db, name: &str, a: &[Vec<u8>], now: u64) -> Value {
  let n = match int_arg(&a[2]) {
    Ok(n) => n,
    Err(e) => return e,
  };
  let at = match name {
    "expire" => n.checked_mul(1000).and_then(|ms| ms.checked_add(now as i64)),
    "pexpire" => n.checked_add(now as i64),
    "expireat" => n.checked_mul(1000),
    _ => Some(n),
  };
  let Some(at) = at else {
    return Value::err(format!("ERR invalid expire time in '{name}' command"));
  };
  let mut flags = [false; 4]; // NX XX GT LT
  for opt in &a[3..] {
    match upper(opt).as_str() {
      "NX" => flags[0] = true,
      "XX" => flags[1] = true,
      "GT" => flags[2] = true,
      "LT" => flags[3] = true,
      other => return Value::err(format!("ERR Unsupported option {other}")),
    }
  }
  let Some(item) = db.live(&a[1], now) else { return Value::Integer(0) };
  let cur = item.expires_at;
  let allowed = (!flags[0] || cur.is_none())
    && (!flags[1] || cur.is_some())
    && (!flags[2] || cur.is_some_and(|c| (at as u64) > c))
    && (!flags[3] || cur.is_none_or(|c| (at as u64) < c));
  if !allowed {
    return Value::Integer(0);
  }
  // Un vencimiento en el pasado borra la clave.
  if at <= now as i64 {
    db.items.remove(&a[1]);
  } else {
    item.expires_at = Some(at as u64);
  }
  Value::Integer(1)
}
