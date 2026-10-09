//! RESP2, el protocolo con el que hablan Redis y sus clientes.
//! https://redis.io/docs/latest/develop/reference/protocol-spec/

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
  Simple(String),
  Error(String),
  Integer(i64),
  Bulk(Vec<u8>),
  NullBulk,
  Array(Vec<Value>),
  NullArray,
}

#[derive(Debug, PartialEq)]
pub struct ParseError(pub String);

impl Value {
  pub fn ok() -> Value {
    Value::Simple("OK".into())
  }
  pub fn err(msg: impl Into<String>) -> Value {
    Value::Error(msg.into())
  }
  pub fn bulk(b: impl Into<Vec<u8>>) -> Value {
    Value::Bulk(b.into())
  }
  pub fn is_error(&self) -> bool {
    matches!(self, Value::Error(_))
  }
}

pub fn parse(buf: &[u8]) -> Result<Option<(Value, usize)>, ParseError> {
  parse_at(buf, 0)
}

/// Lee un valor que empieza en `pos`; devuelve el valor y dónde termina.
fn parse_at(buf: &[u8], pos: usize) -> Result<Option<(Value, usize)>, ParseError> {
  let Some(&kind) = buf.get(pos) else { return Ok(None) };
  // El tipo se valida antes de esperar el fin de línea: un byte inválido es un error ya.
  if !matches!(kind, b'+' | b'-' | b':' | b'$' | b'*') {
    return Err(ParseError(format!("tipo desconocido {:?}", kind as char)));
  }
  let Some(line_end) = find_crlf(buf, pos + 1) else { return Ok(None) };
  let line = &buf[pos + 1..line_end];
  let next = line_end + 2;
  match kind {
    b'+' => Ok(Some((Value::Simple(String::from_utf8_lossy(line).into_owned()), next))),
    b'-' => Ok(Some((Value::Error(String::from_utf8_lossy(line).into_owned()), next))),
    b':' => Ok(Some((Value::Integer(int(line)?), next))),
    b'$' => {
      let len = int(line)?;
      if len == -1 {
        return Ok(Some((Value::NullBulk, next)));
      }
      if len < 0 {
        return Err(ParseError(format!("largo inválido {len}")));
      }
      let end = next + len as usize;
      if buf.len() < end + 2 {
        return Ok(None);
      }
      if &buf[end..end + 2] != b"\r\n" {
        return Err(ParseError("el bulk string no termina en \\r\\n".into()));
      }
      Ok(Some((Value::Bulk(buf[next..end].to_vec()), end + 2)))
    }
    _ => {
      let len = int(line)?;
      if len == -1 {
        return Ok(Some((Value::NullArray, next)));
      }
      if len < 0 {
        return Err(ParseError(format!("largo inválido {len}")));
      }
      let mut items = Vec::with_capacity(len.min(1024) as usize);
      let mut at = next;
      for _ in 0..len {
        match parse_at(buf, at)? {
          Some((item, end)) => {
            items.push(item);
            at = end;
          }
          None => return Ok(None),
        }
      }
      Ok(Some((Value::Array(items), at)))
    }
  }
}

fn find_crlf(buf: &[u8], from: usize) -> Option<usize> {
  buf.get(from..)?.windows(2).position(|w| w == b"\r\n").map(|i| from + i)
}

fn int(line: &[u8]) -> Result<i64, ParseError> {
  std::str::from_utf8(line)
    .ok()
    .and_then(|s| s.parse().ok())
    .ok_or_else(|| ParseError(format!("número inválido {:?}", String::from_utf8_lossy(line))))
}

pub fn encode(value: &Value) -> Vec<u8> {
  let mut out = Vec::new();
  encode_into(value, &mut out);
  out
}

pub fn encode_into(value: &Value, out: &mut Vec<u8>) {
  match value {
    Value::Simple(s) => {
      out.push(b'+');
      out.extend_from_slice(s.as_bytes());
      out.extend_from_slice(b"\r\n");
    }
    Value::Error(s) => {
      out.push(b'-');
      out.extend_from_slice(s.as_bytes());
      out.extend_from_slice(b"\r\n");
    }
    Value::Integer(n) => out.extend_from_slice(format!(":{n}\r\n").as_bytes()),
    Value::Bulk(b) => {
      out.extend_from_slice(format!("${}\r\n", b.len()).as_bytes());
      out.extend_from_slice(b);
      out.extend_from_slice(b"\r\n");
    }
    Value::NullBulk => out.extend_from_slice(b"$-1\r\n"),
    Value::Array(items) => {
      out.extend_from_slice(format!("*{}\r\n", items.len()).as_bytes());
      for item in items {
        encode_into(item, out);
      }
    }
    Value::NullArray => out.extend_from_slice(b"*-1\r\n"),
  }
}

/// Un comando como array de bulk strings, como lo propaga Redis al AOF y a las réplicas.
pub fn command(args: &[Vec<u8>]) -> Vec<u8> {
  encode(&Value::Array(args.iter().map(|a| Value::Bulk(a.clone())).collect()))
}
